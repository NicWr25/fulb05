-- =============================================================================
-- Etapa (b) · 4/5 · Funciones RPC (lo que el navegador llama con supabase.rpc)
-- =============================================================================
--
-- ¿Por qué RPC para `matches` y escrituras directas para `match_players`?
--   - Anotarse, cambiarse y bajarse son operaciones sobre UNA fila: se
--     expresan perfecto como políticas RLS.
--   - Crear o editar un partido implica cálculos y varios pasos atómicos:
--     generar un ID y un token, hashearlo, convertir fecha+hora+zona, y
--     reacomodar jugadores si cambia el formato. Eso vive mejor en una
--     función que corre del lado del servidor, dentro de una transacción.
--
-- Todas son SECURITY DEFINER con `search_path = ''` y validan explícitamente
-- quién llama (auth.uid(), is_match_admin). La lógica de admin se valida acá,
-- en la base, nunca solo en el cliente.

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------
create function private.require_uid()
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'not_authenticated';
  end if;
  return v_uid;
end;
$$;

-- "2026-09-25" + "21:00" en "America/Montevideo" -> instante absoluto.
-- Se hace en SQL (y no en el navegador) para que el resultado no dependa
-- de la zona horaria del dispositivo de quien edita.
create function private.local_to_timestamptz(p_date date, p_time time, p_timezone text)
returns timestamptz
language plpgsql
stable
set search_path = ''
as $$
begin
  perform private.assert_valid_timezone(p_timezone);
  if p_date is null or p_time is null then
    raise exception using errcode = 'P0001', message = 'invalid_starts_at';
  end if;
  return (p_date + p_time) at time zone p_timezone;
end;
$$;

create function private.assert_future_start(p_starts_at timestamptz)
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if p_starts_at <= now() or p_starts_at > now() + interval '1 year' then
    raise exception using errcode = 'P0001', message = 'invalid_starts_at',
      detail = 'La fecha tiene que ser futura y dentro del próximo año.';
  end if;
end;
$$;

-- Texto opcional: '' o solo espacios -> null.
create function private.clean_text(p_text text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(btrim(p_text), '');
$$;

-- -----------------------------------------------------------------------------
-- create_match
-- -----------------------------------------------------------------------------
-- Devuelve { id, admin_token }. El token en texto plano se devuelve UNA sola
-- vez: en la base solo queda su hash SHA-256.
-- ¿Por qué SHA-256 y no bcrypt/argon2? Esos algoritmos son lentos a propósito
-- para proteger contraseñas humanas (poca entropía, atacables por diccionario).
-- Este token son 32 bytes aleatorios (256 bits): no hay diccionario posible,
-- así que un hash rápido alcanza.
create function public.create_match(
  p_format         integer,
  p_title          text,
  p_venue          text,
  p_maps_url       text,
  p_date           date,
  p_time           time,
  p_timezone       text,
  p_organizer_name text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  -- 31 caracteres sin ambiguos (sin i, l, o, 0, 1).
  c_alphabet constant text := 'abcdefghjkmnpqrstuvwxyz23456789';
  v_uid       uuid := private.require_uid();
  v_starts_at timestamptz;
  v_id        text;
  v_bytes     bytea;
  v_byte      int;
  v_token     text;
begin
  -- Rate limit: máximo 10 partidos por identidad cada 24 h.
  -- (Usa el índice matches_created_by_created_at_idx.)
  if (select count(*) from public.matches m
      where m.created_by = v_uid and m.created_at > now() - interval '24 hours') >= 10 then
    raise exception using errcode = 'P0001', message = 'rate_limited',
      detail = 'Creaste demasiados partidos en las últimas 24 horas.';
  end if;

  v_starts_at := private.local_to_timestamptz(p_date, p_time, p_timezone);
  perform private.assert_future_start(v_starts_at);

  -- ID aleatorio con reintento ante colisión (muy improbable: 31^8 combinaciones).
  loop
    v_id := '';
    while char_length(v_id) < 8 loop
      v_bytes := extensions.gen_random_bytes(16);
      for i in 0..15 loop
        v_byte := get_byte(v_bytes, i);
        -- "Rejection sampling": 256 no es múltiplo de 31. Si hiciéramos
        -- byte % 31 directamente, los primeros 8 caracteres saldrían más
        -- seguido. Descartando los bytes >= 248 (= 31·8) queda uniforme.
        if v_byte < 248 then
          v_id := v_id || substr(c_alphabet, (v_byte % 31) + 1, 1);
          exit when char_length(v_id) = 8;
        end if;
      end loop;
    end loop;

    begin
      insert into public.matches
        (id, format, title, venue, maps_url, starts_at, timezone, organizer_name, created_by)
      values
        (v_id, p_format::smallint, private.clean_text(p_title), private.clean_text(p_venue),
         private.clean_text(p_maps_url), v_starts_at, p_timezone,
         private.clean_text(p_organizer_name), v_uid);
      exit;
    exception when unique_violation then
      -- colisión de ID: probar con otro
    end;
  end loop;

  -- Token de admin: 32 bytes aleatorios en base64url (apto para URL, 43 caracteres).
  v_token := translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/=', '-_');

  insert into public.match_admin_secrets (match_id, token_hash)
  values (v_id, extensions.digest(v_token, 'sha256'));

  insert into public.match_admins (match_id, user_id) values (v_id, v_uid);
  insert into public.match_viewers (match_id, user_id) values (v_id, v_uid);

  return jsonb_build_object('id', v_id, 'admin_token', v_token);
end;
$$;

-- -----------------------------------------------------------------------------
-- open_match: "el link es la llave"
-- -----------------------------------------------------------------------------
-- Si el partido existe, registra a quien llama como viewer y devuelve true.
-- A partir de ahí, RLS le deja leer el partido y suscribirse a Realtime.
-- Adivinar IDs por fuerza bruta cuesta del orden de 10^9 requests por acierto.
create function public.open_match(p_match_id text)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_uid();
begin
  if not exists (select 1 from public.matches m where m.id = p_match_id) then
    return false;
  end if;

  insert into public.match_viewers (match_id, user_id)
  values (p_match_id, v_uid)
  on conflict do nothing;

  return true;
end;
$$;

-- -----------------------------------------------------------------------------
-- claim_admin: recuperar el control desde otro dispositivo con el token secreto
-- -----------------------------------------------------------------------------
create function public.claim_admin(p_match_id text, p_token text)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := private.require_uid();
  v_hash bytea;
begin
  if p_token is null or char_length(p_token) > 128 then
    return false;
  end if;

  select s.token_hash into v_hash
  from public.match_admin_secrets s
  where s.match_id = p_match_id;

  -- Se comparan hashes, no tokens: aunque alguien leyera la tabla, no podría
  -- reconstruir el token a partir del hash.
  if v_hash is null or v_hash <> extensions.digest(p_token, 'sha256') then
    return false;
  end if;

  insert into public.match_admins (match_id, user_id)
  values (p_match_id, v_uid) on conflict do nothing;
  insert into public.match_viewers (match_id, user_id)
  values (p_match_id, v_uid) on conflict do nothing;

  return true;
end;
$$;

-- -----------------------------------------------------------------------------
-- get_match_preview: para el render en el servidor y el Open Graph
-- -----------------------------------------------------------------------------
-- La llama el servidor de Next.js con la anon key y SIN sesión (rol anon).
-- Exige conocer el ID, igual que open_match, así que no rompe "el link es la
-- llave". No devuelve user_id ni created_by: el servidor no los necesita.
create function public.get_match_preview(p_match_id text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id',             m.id,
    'format',         m.format,
    'title',          m.title,
    'venue',          m.venue,
    'maps_url',       m.maps_url,
    'starts_at',      m.starts_at,
    'timezone',       m.timezone,
    'organizer_name', m.organizer_name,
    'layout',         m.layout,
    'players', coalesce((
      select jsonb_agg(
               jsonb_build_object('id', p.id, 'name', p.name, 'team', p.team, 'slot', p.slot)
               order by p.team, p.slot nulls last, p.bench_since)
      from public.match_players p
      where p.match_id = m.id
    ), '[]'::jsonb)
  )
  from public.matches m
  where m.id = p_match_id;
$$;

-- -----------------------------------------------------------------------------
-- update_match (solo admin): editar datos y/o formato
-- -----------------------------------------------------------------------------
-- Si cambia el formato (7 -> 5), los que quedan en lugares >= N primero ocupan
-- lugares libres del nuevo rango; si no hay, pasan AL PRINCIPIO del banco
-- (ya estaban jugando). Si crece (5 -> 7), los nuevos lugares se llenan desde
-- el banco. El layout vuelve al de por defecto del nuevo formato.
create function public.update_match(
  p_match_id       text,
  p_format         integer,
  p_title          text,
  p_venue          text,
  p_maps_url       text,
  p_date           date,
  p_time           time,
  p_timezone       text,
  p_organizer_name text
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_old        public.matches;
  v_starts_at  timestamptz;
  v_team       text;
  v_row        record;
  v_free       int;
  v_front      timestamptz;
  v_k          int;
  v_prev       text;
begin
  perform private.require_uid();
  if not private.is_match_admin(p_match_id) then
    raise exception using errcode = '42501', message = 'not_admin';
  end if;

  perform private.lock_match(p_match_id);

  select * into v_old from public.matches m where m.id = p_match_id;

  v_starts_at := private.local_to_timestamptz(p_date, p_time, p_timezone);
  -- Solo se exige fecha futura si la fecha cambió (reprogramar). Así el admin
  -- puede corregir el nombre de la cancha de un partido que ya empezó.
  if v_starts_at <> v_old.starts_at then
    perform private.assert_future_start(v_starts_at);
  end if;

  update public.matches
     set format         = p_format::smallint,
         title          = private.clean_text(p_title),
         venue          = private.clean_text(p_venue),
         maps_url       = private.clean_text(p_maps_url),
         starts_at      = v_starts_at,
         timezone       = p_timezone,
         organizer_name = private.clean_text(p_organizer_name),
         layout         = case when p_format::smallint = v_old.format then v_old.layout end
   where id = p_match_id;

  if p_format::smallint = v_old.format then
    return;
  end if;

  -- Reacomodo interno: los triggers de match_players no revalidan (modo interno).
  v_prev := current_setting('fulb05.internal', true);
  perform set_config('fulb05.internal', 'on', true);

  foreach v_team in array array['A', 'B'] loop
    -- 1) Los que quedaron fuera de rango ocupan lugares libres, en orden.
    for v_row in
      select p.id from public.match_players p
      where p.match_id = p_match_id and p.team = v_team and p.slot >= p_format
      order by p.slot
    loop
      select s into v_free
      from generate_series(0, p_format - 1) as s
      where not exists (
        select 1 from public.match_players p
        where p.match_id = p_match_id and p.team = v_team and p.slot = s)
      order by s limit 1;

      exit when v_free is null;
      update public.match_players set slot = v_free where id = v_row.id;
    end loop;

    -- 2) Los que siguen fuera de rango van al principio del banco, conservando
    --    su orden (el de lugar más bajo queda primero).
    select coalesce(min(p.bench_since), clock_timestamp()) into v_front
    from public.match_players p
    where p.match_id = p_match_id and p.team = v_team and p.slot is null;

    v_k := 0;
    for v_row in
      select p.id from public.match_players p
      where p.match_id = p_match_id and p.team = v_team and p.slot >= p_format
      order by p.slot desc
    loop
      v_k := v_k + 1;
      update public.match_players
         set slot = null,
             bench_since = v_front - v_k * interval '1 millisecond'
       where id = v_row.id;
    end loop;

    -- 3) Si el formato creció, los lugares nuevos se llenan desde el banco.
    perform private.fill_free_slots(p_match_id, v_team);
  end loop;

  perform set_config('fulb05.internal', coalesce(v_prev, ''), true);
end;
$$;

-- -----------------------------------------------------------------------------
-- set_layout (solo admin): guardar las posiciones arrastradas (null = por defecto)
-- -----------------------------------------------------------------------------
create function public.set_layout(p_match_id text, p_layout jsonb)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_format smallint;
begin
  perform private.require_uid();
  if not private.is_match_admin(p_match_id) then
    raise exception using errcode = '42501', message = 'not_admin';
  end if;

  select m.format into v_format from public.matches m where m.id = p_match_id;

  if p_layout is not null and not private.is_valid_layout(p_layout, v_format) then
    raise exception using errcode = 'P0001', message = 'invalid_layout';
  end if;

  update public.matches set layout = p_layout where id = p_match_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Permisos de ejecución
-- -----------------------------------------------------------------------------
-- Supabase da EXECUTE a anon y authenticated sobre toda función nueva de
-- `public`. Lo quitamos y lo damos explícitamente:
--   - authenticated (incluye usuarios anónimos): todas las RPC.
--   - anon (sin sesión, el servidor de Next.js): solo get_match_preview.
revoke all on function public.create_match(integer, text, text, text, date, time, text, text) from public, anon, authenticated;
revoke all on function public.open_match(text) from public, anon, authenticated;
revoke all on function public.claim_admin(text, text) from public, anon, authenticated;
revoke all on function public.get_match_preview(text) from public, anon, authenticated;
revoke all on function public.update_match(text, integer, text, text, text, date, time, text, text) from public, anon, authenticated;
revoke all on function public.set_layout(text, jsonb) from public, anon, authenticated;

grant execute on function public.create_match(integer, text, text, text, date, time, text, text) to authenticated;
grant execute on function public.open_match(text) to authenticated;
grant execute on function public.claim_admin(text, text) to authenticated;
grant execute on function public.get_match_preview(text) to anon, authenticated;
grant execute on function public.update_match(text, integer, text, text, text, date, time, text, text) to authenticated;
grant execute on function public.set_layout(text, jsonb) to authenticated;

revoke all on function private.require_uid() from public;
revoke all on function private.local_to_timestamptz(date, time, text) from public;
revoke all on function private.assert_future_start(timestamptz) from public;
revoke all on function private.clean_text(text) from public;
