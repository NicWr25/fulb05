-- El organizador intercambia dos jugadores sin alterar los lugares ni el layout.
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

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

create temp table ctx (id text, layout jsonb);
grant all on ctx to authenticated;
create function pg_temp.match_id() returns text language sql as $$ select id from ctx $$;
create function pg_temp.player_id(p_name text) returns uuid language sql as $$
  select id from public.match_players where name = p_name and match_id = pg_temp.match_id()
$$;

select pg_temp.login('00000000-0000-0000-0000-00000000000a');
insert into ctx (id) select public.create_match(5, null, null,
  'https://maps.app.goo.gl/abc', current_date + 7, '21:00', 'America/Montevideo', 'Ana') ->> 'id';
update ctx set layout = (select m.layout from public.matches m where m.id = ctx.id);
insert into public.match_players (match_id, user_id, name, team, slot)
values (pg_temp.match_id(), auth.uid(), 'Ana', 'A', 0);
insert into public.match_players (match_id, name, team, slot)
select pg_temp.match_id(), 'A' || s, 'A', s from generate_series(1, 4) s
union all
select pg_temp.match_id(), 'B' || s, 'B', s from generate_series(0, 4) s;

select lives_ok(format('select public.swap_players(%L, %L, %L)',
  pg_temp.match_id(), pg_temp.player_id('Ana'), pg_temp.player_id('B4')),
  'intercambia incluso con ambos equipos llenos');
select is((select team || slot from public.match_players where name = 'Ana'), 'B4',
  'el organizador ocupa el lugar del otro equipo');
select is((select team || slot from public.match_players where name = 'B4'), 'A0',
  'el segundo jugador ocupa el lugar original del organizador');
select is((select user_id from public.match_players where name = 'Ana'), auth.uid(),
  'la identidad del organizador no cambia');
select is((select layout from public.matches where id = pg_temp.match_id()),
  (select layout from ctx), 'las posiciones guardadas quedan intactas');
select is((select count(*)::int from public.match_players where match_id = pg_temp.match_id()),
  10, 'el intercambio no agrega ni quita jugadores');
select throws_ok(format('select public.swap_players(%L, %L, %L)',
  pg_temp.match_id(), pg_temp.player_id('A1'), pg_temp.player_id('A2')),
  'P0001', 'invalid_swap', 'rechaza dos jugadores del mismo equipo');
select throws_ok(format('select public.swap_players(%L, %L, %L)',
  pg_temp.match_id(), pg_temp.player_id('A1'), pg_temp.player_id('A1')),
  'P0001', 'invalid_swap', 'rechaza la misma ficha dos veces');
select throws_ok(format('select public.swap_players(%L, %L, %L)',
  pg_temp.match_id(), pg_temp.player_id('A1'), '00000000-0000-0000-0000-000000000099'),
  'P0001', 'player_not_found', 'rechaza un jugador ajeno al partido');

select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select public.open_match(pg_temp.match_id());
select throws_ok(format('select public.swap_players(%L, %L, %L)',
  pg_temp.match_id(), pg_temp.player_id('Ana'), pg_temp.player_id('B4')),
  '42501', 'not_admin', 'un visitante no puede intercambiar jugadores');

reset role;
update public.matches set starts_at = now() - interval '1 minute' where id = pg_temp.match_id();
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select throws_ok(format('select public.swap_players(%L, %L, %L)',
  pg_temp.match_id(), pg_temp.player_id('Ana'), pg_temp.player_id('B4')),
  'P0001', 'match_closed', 'un partido cerrado no admite intercambios');
reset role;
select is(has_function_privilege('anon', 'public.swap_players(text,uuid,uuid)', 'execute'),
  false, 'la RPC requiere una sesión autenticada');

select * from finish();
rollback;
