-- El selector cambia de equipo y Postgres elige el primer lugar libre.
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users (id, aud, role, email) values
  ('00000000-0000-0000-0000-00000000000a', 'authenticated', 'authenticated', 'ana@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'authenticated', 'authenticated', 'bruno@test.local');

create function pg_temp.login(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;

create temp table ctx (id text);
grant all on ctx to authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
insert into ctx select public.create_match(5, null, null,
  'https://maps.app.goo.gl/abc', current_date + 7, '21:00', 'America/Montevideo', 'Ana') ->> 'id';
insert into public.match_players (match_id, user_id, name, team, slot)
values ((select id from ctx), auth.uid(), 'Ana', 'A', 0);
insert into public.match_players (match_id, user_id, name, team, slot)
select (select id from ctx), null, 'Invitado ' || s, 'B', s
from generate_series(0, 4) s;

select throws_ok(format('select public.change_player_team(%L,
  (select id from public.match_players where name = ''Ana''), ''B'')', (select id from ctx)),
  'P0001', 'team_full', 'un equipo lleno rechaza el cambio');
select is((select team || slot from public.match_players where name = 'Ana'), 'A0',
  'el fallo conserva el equipo y lugar originales');
delete from public.match_players where name = 'Invitado 1';
select lives_ok(format('select public.change_player_team(%L,
  (select id from public.match_players where name = ''Ana''), ''B'')', (select id from ctx)),
  'con un lugar libre, el jugador cambia de equipo');
select is((select team || slot from public.match_players where name = 'Ana'), 'B1',
  'la base asigna el primer lugar libre');
select lives_ok(format('select public.change_player_team(%L,
  (select id from public.match_players where name = ''Invitado 0''), ''A'')', (select id from ctx)),
  'el organizador puede cambiar el equipo de un invitado');
select is((select team || slot from public.match_players where name = 'Invitado 0'), 'A0',
  'el invitado también recibe el primer lugar libre');
reset role;

update public.matches set starts_at = now() - interval '1 minute' where id = (select id from ctx);
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select throws_ok(format('select public.change_player_team(%L,
  (select id from public.match_players where name = ''Ana''), ''A'')', (select id from ctx)),
  'P0001', 'match_closed', 'después del inicio no se cambia de equipo');

reset role;
select * from finish();
rollback;
