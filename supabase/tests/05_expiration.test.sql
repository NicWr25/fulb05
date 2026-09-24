-- Tests de la expiración (private.purge_expired y el job de pg_cron).
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

-- Usuarios: anónimos viejos (con y sin participación), uno reciente y uno "normal".
insert into auth.users (id, aud, role, email, is_anonymous, created_at) values
  ('00000000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', null, true,  now() - interval '40 days'), -- huérfano → se borra
  ('00000000-0000-0000-0000-0000000000a2', 'authenticated', 'authenticated', null, true,  now() - interval '40 days'), -- admin de un partido vigente
  ('00000000-0000-0000-0000-0000000000a3', 'authenticated', 'authenticated', null, true,  now() - interval '40 days'), -- jugador de un partido vigente
  ('00000000-0000-0000-0000-0000000000a4', 'authenticated', 'authenticated', null, true,  now() - interval '2 days'),  -- anónimo reciente
  ('00000000-0000-0000-0000-0000000000a5', 'authenticated', 'authenticated', 'x@test.local', false, now() - interval '400 days'); -- no anónimo

-- Partidos insertados directo (como postgres). Se crean en el futuro, se
-- cargan jugadores (el trigger no deja anotarse en un partido empezado) y
-- después se mueven las fechas al pasado.
insert into public.matches (id, format, venue, starts_at, timezone, organizer_name) values
  ('vxjyz234', 5, 'Cancha', now() + interval '1 day', 'America/Montevideo', 'Ana'),
  ('rcnt2345', 5, 'Cancha', now() + interval '1 day', 'America/Montevideo', 'Ana'),
  ('ftr23456', 5, 'Cancha', now() + interval '2 days', 'America/Montevideo', 'Ana');

insert into public.match_admins (match_id, user_id) values ('ftr23456', '00000000-0000-0000-0000-0000000000a2');
insert into public.match_players (match_id, user_id, name, team, slot)
values ('ftr23456', '00000000-0000-0000-0000-0000000000a3', 'Bruno', 'A', 0),
       ('vxjyz234', null, 'Del viejo', 'A', 0);

update public.matches set starts_at = now() - interval '8 days' where id = 'vxjyz234'; -- se borra
update public.matches set starts_at = now() - interval '6 days' where id = 'rcnt2345'; -- queda (< 7 días)

select is(
  private.purge_expired(),
  '{"matches": 1, "anonymous_users": 1}'::jsonb,
  'borra 1 partido viejo y 1 usuario anónimo huérfano');

select results_eq(
  $$select id from public.matches where id in ('vxjyz234', 'rcnt2345', 'ftr23456') order by id$$,
  $$values ('ftr23456'), ('rcnt2345')$$,
  'solo se borra el partido que empezó hace más de 7 días');
select is(
  (select count(*)::int from public.match_players where match_id = 'vxjyz234'),
  0, 'sus jugadores se van en cascada');

select is((select count(*)::int from auth.users where id = '00000000-0000-0000-0000-0000000000a1'), 0,
  'el anónimo viejo que no participa de nada se borra');
select is((select count(*)::int from auth.users where id = '00000000-0000-0000-0000-0000000000a2'), 1,
  'el anónimo viejo que es admin de un partido vigente queda');
select is((select count(*)::int from auth.users where id = '00000000-0000-0000-0000-0000000000a3'), 1,
  'el anónimo viejo que juega un partido vigente queda');
select is((select count(*)::int from auth.users where id = '00000000-0000-0000-0000-0000000000a4'), 1,
  'el anónimo reciente queda');
select is((select count(*)::int from auth.users where id = '00000000-0000-0000-0000-0000000000a5'), 1,
  'un usuario no anónimo nunca se borra');

select is(
  (select schedule from cron.job where jobname = 'fulb05-purge-expired'),
  '15 7 * * *', 'el job de pg_cron está agendado todos los días a las 07:15 UTC');

select * from finish();
rollback;
