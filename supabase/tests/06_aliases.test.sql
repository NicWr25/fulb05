-- El alias visible es opcional, pero sus permisos se deciden en Postgres.
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

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

select pg_temp.login('00000000-0000-0000-0000-00000000000a');
insert into ctx select public.create_match(5, null, null,
  'https://maps.app.goo.gl/abc', current_date + 7, '21:00', 'America/Montevideo', 'Ana') ->> 'id';
insert into public.match_players (match_id, user_id, name, team, slot)
values ((select id from ctx), auth.uid(), 'Ana', 'B', 0);
insert into public.match_players (match_id, user_id, name, alias, team, slot)
values ((select id from ctx), null, 'Jugador QA 1', 'Jota', 'A', 0);
select is((select alias from public.match_players where name = 'Jugador QA 1'), 'Jota',
  'el organizador puede crear un invitado con alias');
select lives_ok(format('select public.set_player_alias(%L,
  (select id from public.match_players where name = ''Jugador QA 1''), ''Jota 2'')', (select id from ctx)),
  'el organizador edita el alias de un invitado');
select is((public.get_match_preview((select id from ctx)) -> 'players' -> 0 ->> 'alias'), 'Jota 2',
  'la vista previa incluye el alias');
reset role;

select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select public.open_match((select id from ctx));
insert into public.match_players (match_id, user_id, name, team, slot)
values ((select id from ctx), auth.uid(), 'Bruno', 'B', 1);
select lives_ok(format('select public.set_player_alias(%L,
  (select id from public.match_players where name = ''Bruno''), ''Beto'')', (select id from ctx)),
  'cada jugador edita su propio alias');
select throws_ok(format('select public.set_player_alias(%L,
  (select id from public.match_players where name = ''Jugador QA 1''), ''Intruso'')', (select id from ctx)),
  '42501', 'not_your_token', 'otro jugador no edita al invitado del organizador');
select throws_ok($$update public.match_players set alias = 'Intruso' where name = 'Bruno'$$,
  '42501', null, 'nadie edita el alias directamente por UPDATE');
select throws_ok(format('select public.set_player_alias(%L,
  (select id from public.match_players where name = ''Bruno''), repeat(''x'', 25))', (select id from ctx)),
  '23514', null, 'la base limita el alias a 24 caracteres');
select lives_ok(format('select public.set_player_alias(%L,
  (select id from public.match_players where name = ''Bruno''), '''')', (select id from ctx)),
  'el jugador puede borrar su alias');
select is((select alias from public.match_players where name = 'Bruno'), null,
  'borrar el alias conserva el nombre original');
reset role;

select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select throws_ok(format('select public.set_player_alias(%L,
  (select id from public.match_players where name = ''Bruno''), ''Hack'')', (select id from ctx)),
  '42501', 'not_your_token', 'el organizador no edita el alias de un usuario registrado');
reset role;

update public.matches set starts_at = now() - interval '1 minute' where id = (select id from ctx);
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select throws_ok(format('select public.set_player_alias(%L,
  (select id from public.match_players where name = ''Bruno''), ''Beto'')', (select id from ctx)),
  'P0001', 'match_closed', 'el alias no cambia después del inicio');

reset role;
select * from finish();
rollback;
