-- =============================================================================
-- Cada jugador mueve su propia ficha, y solo dentro de su mitad de la cancha
-- =============================================================================
--
-- Antes: solo el organizador guardaba el layout ENTERO con set_layout().
-- Ahora cualquiera mueve SU ficha. Si todos siguieran guardando el layout
-- entero, dos personas moviendo a la vez se pisarían (lost update: el
-- segundo guardado borra el movimiento del primero). Por eso:
--   - move_token() cambia UN punto con jsonb_set dentro de un UPDATE. El
--     UPDATE toma el lock de la fila y relee el valor actual, así que dos
--     movimientos simultáneos se aplican uno después del otro, sin pisarse.
--   - reset_team_layout() (solo admin) restablece un equipo.
--   - set_layout() se elimina.
--
-- Para poder mover un punto con jsonb_set, el layout tiene que existir
-- siempre: se calcula la disposición por defecto EN SQL y la columna pasa a
-- NOT NULL. (Es el mismo algoritmo que lib/domain/positions.ts.)
--
-- Mitades: Claros (A) defienden x = 0 y juegan en x ≤ 50; Oscuros (B) en x ≥ 50.

-- -----------------------------------------------------------------------------
-- Disposición por defecto en SQL
-- -----------------------------------------------------------------------------
-- STABLE (no IMMUTABLE): jsonb_build_object es STABLE en Postgres, y una
-- función no puede prometer ser más "pura" que lo que usa adentro.
create function private.default_team_layout(p_format smallint, p_team text)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  -- Jugadores de campo por línea, de atrás hacia adelante (el arquero va aparte).
  v_lines int[] := case p_format when 5 then array[2, 2] else array[3, 2, 1] end;
  v_n     int := array_length(v_lines, 1);
  v_x     numeric;
  v_y     numeric;
  v_out   jsonb := jsonb_build_array(jsonb_build_object('x', 5.5, 'y', 50));
begin
  for i in 1..v_n loop
    v_x := case when v_n = 1 then 30 else 17 + (i - 1) * (25.0 / (v_n - 1)) end;
    for j in 0..v_lines[i] - 1 loop
      v_y := 15 + (j + 0.5) * 70.0 / v_lines[i];
      v_out := v_out || jsonb_build_object('x', round(v_x, 2), 'y', round(v_y, 2));
    end loop;
  end loop;

  if p_team = 'B' then
    -- Espejo: Oscuros defienden el arco de x = 100.
    select jsonb_agg(jsonb_build_object('x', 100 - (p ->> 'x')::numeric, 'y', (p ->> 'y')::numeric) order by ord)
      into v_out
    from jsonb_array_elements(v_out) with ordinality as t(p, ord);
  end if;
  return v_out;
end;
$$;

create function private.default_layout(p_format smallint)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'A', private.default_team_layout(p_format, 'A'),
    'B', private.default_team_layout(p_format, 'B'));
$$;

-- ¿El punto está en la mitad de su equipo?
create function private.in_own_half(p_team text, p_x numeric)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case p_team when 'A' then p_x <= 50 when 'B' then p_x >= 50 else false end;
$$;

-- -----------------------------------------------------------------------------
-- is_valid_layout: se suma la regla de las mitades
-- -----------------------------------------------------------------------------
-- (create or replace mantiene el CHECK de matches.layout apuntando a esta
-- función; las filas existentes no se revalidan, pero se backfillean abajo.)
create or replace function private.is_valid_layout(p_layout jsonb, p_format smallint)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_team text;
  v_point jsonb;
begin
  if jsonb_typeof(p_layout) <> 'object'
     or (select count(*) from jsonb_object_keys(p_layout)) <> 2
     or not (p_layout ? 'A' and p_layout ? 'B') then
    return false;
  end if;

  foreach v_team in array array['A', 'B'] loop
    if jsonb_typeof(p_layout -> v_team) <> 'array'
       or jsonb_array_length(p_layout -> v_team) <> p_format then
      return false;
    end if;

    for v_point in select value from jsonb_array_elements(p_layout -> v_team) loop
      if jsonb_typeof(v_point) <> 'object'
         or (select count(*) from jsonb_object_keys(v_point)) <> 2
         or jsonb_typeof(v_point -> 'x') <> 'number'
         or jsonb_typeof(v_point -> 'y') <> 'number'
         or (v_point ->> 'x')::numeric not between 0 and 100
         or (v_point ->> 'y')::numeric not between 0 and 100
         or not private.in_own_half(v_team, (v_point ->> 'x')::numeric) then
        return false;
      end if;
    end loop;
  end loop;

  return true;
end;
$$;

-- -----------------------------------------------------------------------------
-- El layout existe siempre
-- -----------------------------------------------------------------------------
-- Si se crea sin layout, o si cambia el formato (la cantidad de puntos ya no
-- coincide), el trigger pone la disposición por defecto. Así create_match y
-- update_match no necesitan cambios.
create or replace function private.matches_before()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.timezone is distinct from old.timezone then
    perform private.assert_valid_timezone(new.timezone);
  end if;
  if new.layout is null or (tg_op = 'UPDATE' and new.format <> old.format) then
    new.layout := private.default_layout(new.format);
  end if;
  return new;
end;
$$;

-- Backfill: los partidos existentes sin layout (o con uno que ahora no es
-- válido por cruzar la mitad) pasan a la disposición por defecto.
update public.matches
   set layout = private.default_layout(format)
 where layout is null or not private.is_valid_layout(layout, format);

alter table public.matches alter column layout set not null;

-- -----------------------------------------------------------------------------
-- move_token: mover UNA ficha
-- -----------------------------------------------------------------------------
-- Puede moverla:
--   - quien ocupa ese lugar (su propia ficha), mientras el partido no empezó;
--   - el admin, cualquier ficha (también lugares libres), siempre.
-- En los dos casos, solo dentro de la mitad del equipo.
create function public.move_token(p_match_id text, p_team text, p_slot integer, p_x numeric, p_y numeric)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := private.require_uid();
  v_match  public.matches;
  v_admin  boolean;
begin
  select * into v_match from public.matches m where m.id = p_match_id;
  if v_match.id is null then
    raise exception using errcode = 'P0001', message = 'match_not_found';
  end if;
  if p_team not in ('A', 'B') or p_slot < 0 or p_slot >= v_match.format then
    raise exception using errcode = 'P0001', message = 'slot_out_of_range';
  end if;

  v_admin := private.is_match_admin(p_match_id);
  if not v_admin then
    if not exists (
      select 1 from public.match_players p
      where p.match_id = p_match_id and p.team = p_team and p.slot = p_slot and p.user_id = v_uid
    ) then
      raise exception using errcode = '42501', message = 'not_your_token';
    end if;
    if now() >= v_match.starts_at then
      raise exception using errcode = 'P0001', message = 'match_closed';
    end if;
  end if;

  if p_x is null or p_y is null or p_x not between 0 and 100 or p_y not between 0 and 100 then
    raise exception using errcode = 'P0001', message = 'invalid_layout';
  end if;
  if not private.in_own_half(p_team, p_x) then
    raise exception using errcode = 'P0001', message = 'wrong_half',
      detail = 'Cada equipo se acomoda en su mitad de la cancha.';
  end if;

  -- jsonb_set dentro de un UPDATE: atómico por fila (no pisa movimientos ajenos).
  update public.matches
     set layout = jsonb_set(
           layout,
           array[p_team, p_slot::text],
           jsonb_build_object('x', round(p_x, 1), 'y', round(p_y, 1)))
   where id = p_match_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- reset_team_layout (solo admin)
-- -----------------------------------------------------------------------------
create function public.reset_team_layout(p_match_id text, p_team text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform private.require_uid();
  if not private.is_match_admin(p_match_id) then
    raise exception using errcode = '42501', message = 'not_admin';
  end if;
  if p_team not in ('A', 'B') then
    raise exception using errcode = 'P0001', message = 'invalid_layout';
  end if;

  update public.matches
     set layout = jsonb_set(layout, array[p_team], private.default_team_layout(format, p_team))
   where id = p_match_id;
end;
$$;

drop function public.set_layout(text, jsonb);

-- -----------------------------------------------------------------------------
-- Permisos
-- -----------------------------------------------------------------------------
revoke all on function private.default_team_layout(smallint, text) from public;
revoke all on function private.default_layout(smallint) from public;
revoke all on function private.in_own_half(text, numeric) from public;

revoke all on function public.move_token(text, text, integer, numeric, numeric) from public, anon, authenticated;
revoke all on function public.reset_team_layout(text, text) from public, anon, authenticated;
grant execute on function public.move_token(text, text, integer, numeric, numeric) to authenticated;
grant execute on function public.reset_team_layout(text, text) to authenticated;
