-- =============================================================================
-- Etapa (b) · 3/5 · Triggers: invariantes que RLS no puede expresar
-- =============================================================================
--
-- RLS responde "¿QUIÉN puede tocar esta fila?". Los triggers cuidan reglas del
-- DOMINIO que valen para todos, incluido el admin:
--   - el partido cierra a la hora de inicio;
--   - slot < formato (un CHECK no puede mirar otra tabla);
--   - máximo 6 en el banco por equipo;
--   - si se libera un lugar, entra el primero del banco (ascenso automático).
--
-- Errores: se lanzan con SQLSTATE P0001 y un `message` corto y estable
-- (match_closed, bench_full, ...). PostgREST lo devuelve tal cual como
-- { code, message } y el frontend lo traduce a castellano (lib/domain/errors.ts).

-- -----------------------------------------------------------------------------
-- Modo "interno"
-- -----------------------------------------------------------------------------
-- Cuando el propio sistema reacomoda jugadores (ascenso del banco, cambio de
-- formato), esos UPDATE vuelven a disparar los triggers. Con esta marca,
-- local a la transacción, los triggers saben que no es un usuario y no
-- revalidan ni vuelven a encadenar ascensos.
-- ¿Un usuario podría activarla? No: requiere ejecutar set_config(), y desde el
-- navegador solo se puede llamar a tablas y funciones del schema `public`.
create function private.is_internal()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(current_setting('fulb05.internal', true), '') = 'on';
$$;

-- Serializa las escrituras de UN partido (no bloquea a los demás partidos).
-- Sin esto, dos "anotarme al primer lugar libre" simultáneos podrían ver el
-- mismo lugar libre y uno fallaría con un error de duplicado confuso. Con el
-- lock, el segundo espera a que el primero termine y ve el estado ya actualizado.
-- Es un advisory lock "de transacción": se libera solo en el commit o rollback.
create function private.lock_match(p_match_id text)
returns void
language sql
set search_path = ''
as $$
  select pg_advisory_xact_lock(hashtextextended('fulb05:match:' || p_match_id, 0));
$$;

-- -----------------------------------------------------------------------------
-- Ascenso automático del banco
-- -----------------------------------------------------------------------------
-- Llena los lugares libres (0..format-1) de un equipo con los primeros del
-- banco, por orden de llegada al banco. SECURITY DEFINER porque mueve la
-- inscripción de OTRA persona, algo que RLS (con razón) no le permite al
-- usuario que disparó el cambio.
create function private.fill_free_slots(p_match_id text, p_team text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_format smallint;
  v_slot   int;
  v_next   uuid;
  v_prev   text := current_setting('fulb05.internal', true);
begin
  select m.format into v_format from public.matches m where m.id = p_match_id;
  if v_format is null then
    return; -- el partido se está borrando (cascade)
  end if;

  perform set_config('fulb05.internal', 'on', true);

  for v_slot in
    select s
    from generate_series(0, v_format - 1) as s
    where not exists (
      select 1 from public.match_players p
      where p.match_id = p_match_id and p.team = p_team and p.slot = s
    )
    order by s
  loop
    select p.id into v_next
    from public.match_players p
    where p.match_id = p_match_id and p.team = p_team and p.slot is null
    order by p.bench_since, p.id
    limit 1;

    exit when v_next is null; -- banco vacío

    update public.match_players
       set slot = v_slot, bench_since = null
     where id = v_next;
  end loop;

  -- Restaura el valor anterior (puede ser 'on' si nos llamó otra función interna).
  perform set_config('fulb05.internal', coalesce(v_prev, ''), true);
end;
$$;

-- -----------------------------------------------------------------------------
-- BEFORE: validaciones y mantenimiento de bench_since
-- -----------------------------------------------------------------------------
create function private.match_players_before()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_match_id  text := coalesce(new.match_id, old.match_id);
  v_format    smallint;
  v_starts_at timestamptz;
  v_bench     int;
begin
  if private.is_internal() then
    return coalesce(new, old);
  end if;

  perform private.lock_match(v_match_id);

  select m.format, m.starts_at into v_format, v_starts_at
  from public.matches m where m.id = v_match_id;

  if v_format is null then
    -- El partido no existe (insert) o se está borrando en cascada (delete).
    if tg_op = 'DELETE' then return old; end if;
    raise exception using errcode = 'P0001', message = 'match_not_found';
  end if;

  -- Cierre a la hora de inicio: vale para todos, también para el admin.
  if now() >= v_starts_at then
    raise exception using errcode = 'P0001', message = 'match_closed',
      detail = 'Las inscripciones cierran a la hora de inicio del partido.';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  if new.slot is not null and new.slot >= v_format then
    raise exception using errcode = 'P0001', message = 'slot_out_of_range',
      detail = format('En fútbol %s los lugares van de 0 a %s.', v_format, v_format - 1);
  end if;

  if new.slot is null then
    -- Entra al banco (recién anotado, o se cambió a un equipo lleno):
    -- se pone al final de la fila. clock_timestamp() (y no now(), que es fijo
    -- durante toda la transacción) para ordenar bien varias altas seguidas.
    if tg_op = 'INSERT' or old.slot is not null or old.team <> new.team then
      new.bench_since := clock_timestamp();

      select count(*) into v_bench
      from public.match_players p
      where p.match_id = new.match_id and p.team = new.team
        and p.slot is null and p.id <> new.id;

      if v_bench >= 6 then
        raise exception using errcode = 'P0001', message = 'bench_full',
          detail = 'Ya hay 6 suplentes en ese equipo.';
      end if;
    end if;
  else
    new.bench_since := null;
  end if;

  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- AFTER: si se liberó un lugar (o alguien entró al banco con lugares libres),
-- completar desde el banco.
-- -----------------------------------------------------------------------------
-- Efecto útil: insertar con slot null significa "el primer lugar libre, o el
-- banco si está lleno". El cliente no tiene que calcular el lugar libre ni
-- reintentar ante carreras: lo resuelve la base, bajo el lock del partido.
create function private.match_players_after()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.is_internal() then
    return null;
  end if;

  if tg_op in ('UPDATE', 'DELETE') then
    perform private.fill_free_slots(old.match_id, old.team);
  end if;

  if tg_op = 'INSERT' or (tg_op = 'UPDATE' and new.team <> old.team) then
    perform private.fill_free_slots(new.match_id, new.team);
  end if;

  return null; -- en un AFTER trigger el valor de retorno se ignora
end;
$$;

create trigger match_players_before
  before insert or update or delete on public.match_players
  for each row execute function private.match_players_before();

create trigger match_players_after
  after insert or update or delete on public.match_players
  for each row execute function private.match_players_after();

-- -----------------------------------------------------------------------------
-- matches: zona horaria válida
-- -----------------------------------------------------------------------------
-- Un CHECK debería usar funciones inmutables, y pg_timezone_names depende de
-- archivos del sistema, así que se valida en un trigger (defensa en
-- profundidad: las RPC también la validan antes de convertir la hora).
create function private.assert_valid_timezone(p_timezone text)
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if p_timezone is null
     or not exists (select 1 from pg_catalog.pg_timezone_names where name = p_timezone) then
    raise exception using errcode = 'P0001', message = 'invalid_timezone';
  end if;
end;
$$;

create function private.matches_before()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.timezone is distinct from old.timezone then
    perform private.assert_valid_timezone(new.timezone);
  end if;
  return new;
end;
$$;

create trigger matches_before
  before insert or update on public.matches
  for each row execute function private.matches_before();

-- Las funciones de trigger no se llaman directamente: se quita el EXECUTE a
-- todos. (Los triggers se disparan igual; el permiso no aplica a ellos.)
revoke all on function private.is_internal() from public;
revoke all on function private.lock_match(text) from public;
revoke all on function private.fill_free_slots(text, text) from public;
revoke all on function private.match_players_before() from public;
revoke all on function private.match_players_after() from public;
revoke all on function private.assert_valid_timezone(text) from public;
revoke all on function private.matches_before() from public;
