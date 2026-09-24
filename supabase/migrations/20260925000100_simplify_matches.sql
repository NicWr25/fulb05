-- El creador administra desde su sesión anónima. No hay recuperación por token.
create or replace function private.is_match_admin(p_match_id text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.matches m
    where m.id = p_match_id and m.created_by = (select auth.uid())
  );
$$;

drop function public.claim_admin(text, text);
drop table public.match_admin_secrets;
drop table public.match_admins;

-- La ubicación de Maps es obligatoria para partidos nuevos; el nombre es opcional.
-- Se conservan partidos anteriores sin Maps para no borrar sus datos.
alter table public.matches alter column venue drop not null;
alter table public.matches drop constraint matches_venue_check;
alter table public.matches add constraint matches_venue_check check (
  venue is null or (char_length(venue) between 1 and 80
    and venue = btrim(venue) and venue !~ '[[:cntrl:]]')
);

-- Los suplentes existentes se eliminan por decisión de producto.
drop trigger match_players_after on public.match_players;
select set_config('fulb05.internal', 'on', true);
delete from public.match_players where slot is null;
select set_config('fulb05.internal', '', true);
drop function private.match_players_after();
drop function private.fill_free_slots(text, text);
alter table public.match_players drop constraint match_players_bench_since_chk;
alter table public.match_players drop column bench_since;
alter table public.match_players alter column slot set not null;

-- slot null en una escritura significa «primer lugar libre»; nunca se guarda null.
create or replace function private.match_players_before()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_match_id text := coalesce(new.match_id, old.match_id);
  v_format smallint;
  v_starts_at timestamptz;
begin
  if private.is_internal() then return coalesce(new, old); end if;
  perform private.lock_match(v_match_id);
  select m.format, m.starts_at into v_format, v_starts_at
  from public.matches m where m.id = v_match_id;
  if v_format is null then
    if tg_op = 'DELETE' then return old; end if;
    raise exception using errcode = 'P0001', message = 'match_not_found';
  end if;
  if now() >= v_starts_at then
    raise exception using errcode = 'P0001', message = 'match_closed';
  end if;
  if tg_op = 'DELETE' then
    if old.user_id = (select m.created_by from public.matches m where m.id = old.match_id) then
      raise exception using errcode = 'P0001', message = 'organizer_must_play';
    end if;
    return old;
  end if;
  if new.slot is null then
    select s into new.slot from generate_series(0, v_format - 1) as s
    where not exists (
      select 1 from public.match_players p
      where p.match_id = v_match_id and p.team = new.team and p.slot = s
        and p.id is distinct from new.id
    ) order by s limit 1;
    if new.slot is null then
      raise exception using errcode = 'P0001', message = 'team_full';
    end if;
  end if;
  if new.slot < 0 or new.slot >= v_format then
    raise exception using errcode = 'P0001', message = 'slot_out_of_range';
  end if;
  return new;
end;
$$;

-- create_match conserva su firma para no cambiar los clientes existentes.
create or replace function public.create_match(
  p_format integer, p_title text, p_venue text, p_maps_url text,
  p_date date, p_time time, p_timezone text, p_organizer_name text
)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  c_alphabet constant text := 'abcdefghjkmnpqrstuvwxyz23456789';
  v_uid uuid := private.require_uid();
  v_starts_at timestamptz;
  v_id text;
  v_bytes bytea;
  v_byte int;
begin
  if (select count(*) from public.matches m
      where m.created_by = v_uid and m.created_at > now() - interval '24 hours') >= 10 then
    raise exception using errcode = 'P0001', message = 'rate_limited';
  end if;
  if private.clean_text(p_maps_url) is null then
    raise exception using errcode = 'P0001', message = 'maps_required';
  end if;
  v_starts_at := private.local_to_timestamptz(p_date, p_time, p_timezone);
  perform private.assert_future_start(v_starts_at);
  loop
    v_id := '';
    while char_length(v_id) < 8 loop
      v_bytes := extensions.gen_random_bytes(16);
      for i in 0..15 loop
        v_byte := get_byte(v_bytes, i);
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
      -- Un ID aleatorio ya existente se vuelve a generar.
    end;
  end loop;
  insert into public.match_viewers (match_id, user_id) values (v_id, v_uid);
  return jsonb_build_object('id', v_id);
end;
$$;

create or replace function public.update_match(
  p_match_id text, p_format integer, p_title text, p_venue text,
  p_maps_url text, p_date date, p_time time, p_timezone text,
  p_organizer_name text
)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare
  v_old public.matches;
  v_starts_at timestamptz;
  v_team text;
  v_row record;
  v_free int;
  v_prev text;
begin
  perform private.require_uid();
  if not private.is_match_admin(p_match_id) then
    raise exception using errcode = '42501', message = 'not_admin';
  end if;
  perform private.lock_match(p_match_id);
  select * into v_old from public.matches m where m.id = p_match_id;
  if v_old.id is null then
    raise exception using errcode = 'P0001', message = 'match_not_found';
  end if;
  if p_format not in (5, 7) then
    raise exception using errcode = 'P0001', message = 'invalid_format';
  end if;
  if private.clean_text(p_maps_url) is null then
    raise exception using errcode = 'P0001', message = 'maps_required';
  end if;
  if exists (
    select 1 from public.match_players p
    where p.match_id = p_match_id group by p.team having count(*) > p_format
  ) then
    raise exception using errcode = 'P0001', message = 'format_too_small';
  end if;
  v_starts_at := private.local_to_timestamptz(p_date, p_time, p_timezone);
  if v_starts_at <> v_old.starts_at then
    perform private.assert_future_start(v_starts_at);
  end if;
  update public.matches
     set format = p_format::smallint, title = private.clean_text(p_title),
         venue = private.clean_text(p_venue), maps_url = private.clean_text(p_maps_url),
         starts_at = v_starts_at, timezone = p_timezone,
         organizer_name = private.clean_text(p_organizer_name),
         layout = case when p_format::smallint = v_old.format then v_old.layout end
   where id = p_match_id;
  if p_format::smallint = v_old.format then return; end if;
  v_prev := current_setting('fulb05.internal', true);
  perform set_config('fulb05.internal', 'on', true);
  foreach v_team in array array['A', 'B'] loop
    for v_row in
      select p.id from public.match_players p
      where p.match_id = p_match_id and p.team = v_team and p.slot >= p_format
      order by p.slot
    loop
      select s into v_free from generate_series(0, p_format - 1) as s
      where not exists (
        select 1 from public.match_players p
        where p.match_id = p_match_id and p.team = v_team and p.slot = s
      ) order by s limit 1;
      update public.match_players set slot = v_free where id = v_row.id;
    end loop;
  end loop;
  perform set_config('fulb05.internal', coalesce(v_prev, ''), true);
end;
$$;

-- El admin mueve cualquier ficha ocupada; cada jugador mueve solo la suya.
create or replace function public.move_token(
  p_match_id text, p_team text, p_slot integer, p_x numeric, p_y numeric
)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_uid();
  v_match public.matches;
begin
  select * into v_match from public.matches m where m.id = p_match_id;
  if v_match.id is null then
    raise exception using errcode = 'P0001', message = 'match_not_found';
  end if;
  if p_team not in ('A', 'B') or p_slot is null or p_slot < 0 or p_slot >= v_match.format then
    raise exception using errcode = 'P0001', message = 'slot_out_of_range';
  end if;
  if not exists (
    select 1 from public.match_players p
    where p.match_id = p_match_id and p.team = p_team and p.slot = p_slot
      and (p.user_id = v_uid or private.is_match_admin(p_match_id))
  ) then
    raise exception using errcode = '42501', message = 'not_your_token';
  end if;
  if now() >= v_match.starts_at then
    raise exception using errcode = 'P0001', message = 'match_closed';
  end if;
  if p_x is null or p_y is null or p_x not between 0 and 100 or p_y not between 0 and 100 then
    raise exception using errcode = 'P0001', message = 'invalid_layout';
  end if;
  if not private.in_own_half(p_team, p_x) then
    raise exception using errcode = 'P0001', message = 'wrong_half';
  end if;
  update public.matches
     set layout = jsonb_set(layout, array[p_team, p_slot::text],
       jsonb_build_object('x', round(p_x, 1), 'y', round(p_y, 1)))
   where id = p_match_id;
end;
$$;

create function public.move_player_slot(
  p_match_id text, p_player_id uuid, p_team text, p_slot integer
)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare
  v_match public.matches;
begin
  perform private.require_uid();
  if not private.is_match_admin(p_match_id) then
    raise exception using errcode = '42501', message = 'not_admin';
  end if;
  perform private.lock_match(p_match_id);
  select * into v_match from public.matches m where m.id = p_match_id;
  if v_match.id is null then
    raise exception using errcode = 'P0001', message = 'match_not_found';
  end if;
  if now() >= v_match.starts_at then
    raise exception using errcode = 'P0001', message = 'match_closed';
  end if;
  if p_team not in ('A', 'B') or p_slot is null or p_slot < 0 or p_slot >= v_match.format then
    raise exception using errcode = 'P0001', message = 'slot_out_of_range';
  end if;
  if not exists (
    select 1 from public.match_players p
    where p.id = p_player_id and p.match_id = p_match_id
  ) then
    raise exception using errcode = 'P0001', message = 'player_not_found';
  end if;
  if exists (
    select 1 from public.match_players p
    where p.match_id = p_match_id and p.team = p_team and p.slot = p_slot
      and p.id <> p_player_id
  ) then
    raise exception using errcode = 'P0001', message = 'slot_taken';
  end if;
  update public.match_players set team = p_team, slot = p_slot where id = p_player_id;
end;
$$;

revoke all on function public.move_player_slot(text, uuid, text, integer)
  from public, anon, authenticated;
grant execute on function public.move_player_slot(text, uuid, text, integer) to authenticated;

-- La limpieza periódica conserva al creador mientras tenga un partido activo.
create or replace function private.purge_expired(
  p_match_age interval default interval '7 days',
  p_user_age interval default interval '30 days'
) returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare v_matches int; v_users int;
begin
  delete from public.matches m where m.starts_at < now() - p_match_age;
  get diagnostics v_matches = row_count;
  delete from auth.users u where u.is_anonymous and u.created_at < now() - p_user_age
    and not exists (select 1 from public.matches m where m.created_by = u.id)
    and not exists (select 1 from public.match_players p where p.user_id = u.id);
  get diagnostics v_users = row_count;
  return jsonb_build_object('matches', v_matches, 'anonymous_users', v_users);
end;
$$;

-- La vista previa ya no ordena por la columna de suplentes eliminada.
create or replace function public.get_match_preview(p_match_id text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', m.id, 'format', m.format, 'title', m.title, 'venue', m.venue,
    'maps_url', m.maps_url, 'starts_at', m.starts_at, 'timezone', m.timezone,
    'organizer_name', m.organizer_name, 'layout', m.layout, 'server_now', now(),
    'players', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name,
        'team', p.team, 'slot', p.slot) order by p.team, p.slot)
      from public.match_players p where p.match_id = m.id
    ), '[]'::jsonb)
  ) from public.matches m where m.id = p_match_id;
$$;
