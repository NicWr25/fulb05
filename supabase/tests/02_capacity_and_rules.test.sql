-- Capacidad exacta, asignación automática, cambio de formato y cierre.
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users (id, aud, role, email)
select ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
  'authenticated', 'authenticated', 'u' || n || '@test.local'
from generate_series(0, 8) as n;
create function pg_temp.uid(n int) returns uuid language sql as $$
  select ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid;
$$;
create function pg_temp.login(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;
create temp table ctx (id text);
grant all on ctx to authenticated;
select pg_temp.login(pg_temp.uid(0));
insert into ctx select public.create_match(5, null, null, 'https://maps.app.goo.gl/abc',
  current_date + 3, '20:00', 'America/Montevideo', 'Ana') ->> 'id';
insert into public.match_players (match_id, user_id, name, team, slot)
values ((select id from ctx), pg_temp.uid(0), 'Ana', 'A', null);
reset role;
select is((select slot::int from public.match_players where user_id = pg_temp.uid(0)), 0,
  'el organizador ocupa el primer lugar libre');

select pg_temp.login(pg_temp.uid(0));
insert into public.match_players (match_id, user_id, name, team, slot)
select (select id from ctx), null, 'Invitado ' || n, 'A', null from generate_series(1, 4) n;
select is((select count(*)::int from public.match_players where team = 'A' and match_id = (select id from ctx)), 5,
  'el equipo tiene exactamente cinco lugares');
select throws_ok(
  $$insert into public.match_players (match_id, user_id, name, team, slot)
    values ((select id from ctx), null, 'Sexto', 'A', null)$$,
  'P0001', 'team_full', 'el sexto no entra al banco');
select throws_ok(
  $$delete from public.match_players where user_id = pg_temp.uid(0)$$,
  'P0001', 'organizer_must_play', 'el organizador no puede bajarse');
select lives_ok(
  $$select public.update_match((select id from ctx), 7, null, null,
    'https://maps.app.goo.gl/abc', current_date + 3, '20:00', 'America/Montevideo', 'Ana')$$,
  'se puede ampliar a 7');
insert into public.match_players (match_id, user_id, name, team, slot)
select (select id from ctx), null, 'Extra ' || n, 'A', null from generate_series(1, 2) n;
select throws_ok(
  $$select public.update_match((select id from ctx), 5, null, null,
    'https://maps.app.goo.gl/abc', current_date + 3, '20:00', 'America/Montevideo', 'Ana')$$,
  'P0001', 'format_too_small', 'no se reduce el formato si sobran jugadores');
-- Se liberan los lugares bajos para que la reducción de 7 a 5 tenga que reubicar.
delete from public.match_players where name in ('Invitado 1', 'Invitado 2');
select lives_ok(
  $$select public.update_match((select id from ctx), 5, null, null,
    'https://maps.app.goo.gl/abc', current_date + 3, '20:00', 'America/Montevideo', 'Ana')$$,
  'con cinco jugadores, la reducción es válida');
select is((select max(slot)::int from public.match_players where match_id = (select id from ctx)), 4,
  'los lugares fuera de rango se reubican');
reset role;
update public.matches set starts_at = now() - interval '1 minute' where id = (select id from ctx);
select pg_temp.login(pg_temp.uid(0));
select throws_ok(
  $$delete from public.match_players where name = 'Extra 1'$$,
  'P0001', 'match_closed', 'el partido cerrado impide sacar jugadores');
select lives_ok(
  $$select public.update_match((select id from ctx), 5, null, null,
    'https://maps.app.goo.gl/abc', current_date + 10, '20:00', 'America/Montevideo', 'Ana')$$,
  'el organizador puede reprogramar');
reset role;
select * from finish();
rollback;
