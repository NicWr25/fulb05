-- El alta guarda el slot y el punto final en una sola transacción.
begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

insert into auth.users (id, aud, role, email) values
  ('00000000-0000-0000-0000-00000000000a', 'authenticated', 'authenticated', 'ana@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'authenticated', 'authenticated', 'bruno@test.local'),
  ('00000000-0000-0000-0000-00000000000c', 'authenticated', 'authenticated', 'caro@test.local');

create function pg_temp.login(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;

create temp table ctx (id text);
grant all on ctx to authenticated;
create function pg_temp.id() returns text language sql as $$ select id from ctx $$;

select pg_temp.login('00000000-0000-0000-0000-00000000000a');
insert into ctx select public.create_match(5, null, null,
  'https://maps.app.goo.gl/abc', current_date + 7, '21:00', 'America/Montevideo', 'Ana') ->> 'id';

select is((public.join_match(pg_temp.id(), 'A', 'Ana', null, 24.34, 50.05, false) ->> 'slot')::int,
  0, 'el organizador obtiene el primer lugar libre');
select is((select layout -> 'A' -> 0 from public.matches where id = pg_temp.id()),
  '{"x":24.3,"y":50.1}'::jsonb, 'la posición inicial queda guardada y redondeada');
select is((select user_id from public.match_players where name = 'Ana'), auth.uid(),
  'el usuario del alta se toma de la sesión, no del cliente');

select is((public.join_match(pg_temp.id(), 'B', 'Invitado', '', 76, 40, true) ->> 'slot')::int,
  0, 'el organizador también agrega un invitado');
select is((select user_id from public.match_players where name = 'Invitado'), null::uuid,
  'el invitado no tiene usuario');
select is((select layout -> 'B' -> 0 from public.matches where id = pg_temp.id()),
  '{"x":76,"y":40}'::jsonb, 'la posición del invitado se comparte igual');

select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select public.open_match(pg_temp.id());
select throws_ok(format($$select public.join_match(%L, 'B', 'Intruso', null, 70, 50, true)$$, pg_temp.id()),
  '42501', 'not_admin', 'un visitante no agrega invitados');
select is((public.join_match(pg_temp.id(), 'A', 'Bruno', null, 30, 60, false) ->> 'slot')::int,
  1, 'un visitante entra al siguiente lugar libre');
select is((select user_id from public.match_players where name = 'Bruno'), auth.uid(),
  'el visitante solo puede anotarse a sí mismo');
select throws_ok(format($$select public.join_match(%L, 'B', 'Otro', null, 40, 50, false)$$, pg_temp.id()),
  'P0001', 'wrong_half', 'rechaza un destino en la mitad rival');
select throws_ok(format($$select public.join_match(%L, 'A', 'Otro', null, 120, 50, false)$$, pg_temp.id()),
  'P0001', 'invalid_layout', 'rechaza coordenadas fuera de la cancha');
select is((select count(*)::int from public.match_players where match_id = pg_temp.id()),
  3, 'un alta rechazada no deja jugadores a medio crear');

select pg_temp.login('00000000-0000-0000-0000-00000000000a');
do $$ begin
  for i in 1..3 loop
    perform public.join_match(pg_temp.id(), 'A', 'Extra ' || i, null, 20 + i, 30 + i, true);
  end loop;
end $$;
select pg_temp.login('00000000-0000-0000-0000-00000000000c');
select public.open_match(pg_temp.id());
select throws_ok(format($$select public.join_match(%L, 'A', 'Caro', null, 25, 50, false)$$, pg_temp.id()),
  'P0001', 'team_full', 'un equipo lleno rechaza el alta');

reset role;
update public.matches set starts_at = now() - interval '1 minute' where id = pg_temp.id();
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select throws_ok(format($$select public.join_match(%L, 'B', 'Tarde', null, 75, 50, true)$$, pg_temp.id()),
  'P0001', 'match_closed', 'el partido cerrado rechaza el alta');
reset role;
select is(has_function_privilege('anon', 'public.join_match(text,text,text,text,numeric,numeric,boolean)', 'execute'),
  false, 'la función requiere sesión autenticada');

select * from finish();
rollback;
