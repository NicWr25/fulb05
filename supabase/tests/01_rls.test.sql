-- Tests de RLS y permisos: quién puede leer y escribir qué.
-- Se corren con `pnpm db:test` (supabase test db). Todo pasa dentro de una
-- transacción que al final se revierte: no deja datos.
begin;
create extension if not exists pgtap with schema extensions;
select plan(28);

-- ---------------------------------------------------------------------------
-- Preparación: usuarios de prueba y un helper para "loguearse"
-- ---------------------------------------------------------------------------
insert into auth.users (id, aud, role, email) values
  ('00000000-0000-0000-0000-00000000000a', 'authenticated', 'authenticated', 'ana@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'authenticated', 'authenticated', 'bruno@test.local'),
  ('00000000-0000-0000-0000-00000000000c', 'authenticated', 'authenticated', 'caro@test.local');

-- Simula lo que hace PostgREST con un JWT: cambia al rol `authenticated` y
-- publica los claims, de donde auth.uid() lee el `sub`.
create function pg_temp.login(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;

-- Guardamos el id y el token del partido para usarlos en varios tests.
create temp table ctx (k text primary key, v text);
grant all on ctx to authenticated, anon;

-- Ana crea un partido (queda como admin y viewer).
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
insert into ctx
select key, value
from jsonb_each_text(public.create_match(
  5, 'Fútbol del viernes', 'Cancha Parque', null,
  current_date + 7, '21:00', 'America/Montevideo', 'Ana'));
reset role;

select matches(
  (select v from ctx where k = 'id'), '^[a-hjkmnp-z2-9]{8}$',
  'create_match devuelve un id de 8 caracteres del alfabeto sin ambiguos');
select is(
  char_length((select v from ctx where k = 'admin_token')), 43,
  'create_match devuelve un token de admin base64url de 43 caracteres');
select isnt(
  (select encode(token_hash, 'hex') from public.match_admin_secrets
   where match_id = (select v from ctx where k = 'id')),
  (select v from ctx where k = 'admin_token'),
  'en la base se guarda el hash del token, no el token');

-- ---------------------------------------------------------------------------
-- anon (sin sesión): no toca tablas; solo la vista previa por ID
-- ---------------------------------------------------------------------------
set local role anon;
select throws_ok('select * from public.matches', '42501', null,
  'anon no puede leer matches directo');
select is(
  public.get_match_preview((select v from ctx where k = 'id')) ->> 'venue', 'Cancha Parque',
  'anon puede pedir la vista previa si conoce el ID');
select throws_ok(
  format('select public.open_match(%L)', (select v from ctx where k = 'id')), '42501', null,
  'anon no puede llamar a open_match');
reset role;

-- ---------------------------------------------------------------------------
-- "El link es la llave"
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select is_empty('select * from public.matches',
  'Bruno no ve ningún partido antes de abrir el link (no se puede listar)');
select is(public.open_match('zzzzzzzz'), false,
  'open_match con un ID inexistente devuelve false');
select is(public.open_match((select v from ctx where k = 'id')), true,
  'open_match con el ID correcto devuelve true');
select is((select count(*)::int from public.matches), 1,
  'después de abrir el link, Bruno ve ese partido (y solo ese)');

-- ---------------------------------------------------------------------------
-- Anotarse solo como uno mismo
-- ---------------------------------------------------------------------------
select throws_ok(
  format($$insert into public.match_players (match_id, user_id, name, team, slot)
           values (%L, '00000000-0000-0000-0000-00000000000a', 'Ana trucha', 'A', 1)$$,
         (select v from ctx where k = 'id')),
  '42501', null,
  'Bruno no puede anotar a otra persona (user_id ajeno)');

select lives_ok(
  format($$insert into public.match_players (match_id, user_id, name, team, slot)
           values (%L, '00000000-0000-0000-0000-00000000000b', 'Bruno', 'A', 0)$$,
         (select v from ctx where k = 'id')),
  'Bruno se anota como él mismo');

select throws_ok(
  format($$insert into public.match_players (match_id, user_id, name, team, slot)
           values (%L, '00000000-0000-0000-0000-00000000000b', 'Bruno otra vez', 'B', 0)$$,
         (select v from ctx where k = 'id')),
  '23505', 'duplicate key value violates unique constraint "match_players_user_key"',
  'una sola inscripción por persona y partido');

select throws_ok(
  format($$insert into public.match_players (match_id, user_id, name, team, slot)
           values (%L, '00000000-0000-0000-0000-00000000000b', 'Bruno', 'A', 5)$$,
         (select v from ctx where k = 'id')),
  'P0001', 'slot_out_of_range',
  'en fútbol 5 no existe el lugar 5 (van de 0 a 4)');

select throws_ok(
  $$update public.match_players set user_id = '00000000-0000-0000-0000-00000000000c'
    where user_id = '00000000-0000-0000-0000-00000000000b'$$,
  '42501', null,
  'nadie puede cambiar el user_id de una inscripción (grant por columna)');

-- ---------------------------------------------------------------------------
-- Concurrencia: mismo lugar
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-00000000000c');
select public.open_match((select v from ctx where k = 'id'));
select throws_ok(
  format($$insert into public.match_players (match_id, user_id, name, team, slot)
           values (%L, '00000000-0000-0000-0000-00000000000c', 'Caro', 'A', 0)$$,
         (select v from ctx where k = 'id')),
  '23505', 'duplicate key value violates unique constraint "match_players_slot_key"',
  'si el lugar ya está ocupado, falla con la constraint match_players_slot_key');

-- ---------------------------------------------------------------------------
-- Modificar / borrar solo lo propio
-- ---------------------------------------------------------------------------
-- En UPDATE/DELETE, RLS no tira error: la fila ajena simplemente "no existe"
-- para Caro, así que se afectan 0 filas.
update public.match_players set name = 'Hackeado'
 where user_id = '00000000-0000-0000-0000-00000000000b';
delete from public.match_players
 where user_id = '00000000-0000-0000-0000-00000000000b';
reset role;
select is(
  (select name from public.match_players where user_id = '00000000-0000-0000-0000-00000000000b'),
  'Bruno',
  'Caro no pudo renombrar ni borrar la inscripción de Bruno');

select pg_temp.login('00000000-0000-0000-0000-00000000000c');
select throws_ok(
  format($$insert into public.match_players (match_id, user_id, name, team, slot)
           values (%L, null, 'Invitado', 'B', 0)$$,
         (select v from ctx where k = 'id')),
  '42501', null,
  'alguien que no es admin no puede agregar jugadores sin user_id');
reset role;

select pg_temp.login('00000000-0000-0000-0000-00000000000b');
update public.match_players set team = 'B', slot = 3
 where user_id = '00000000-0000-0000-0000-00000000000b';
reset role;
select is(
  (select team || slot from public.match_players
   where user_id = '00000000-0000-0000-0000-00000000000b'),
  'B3', 'Bruno sí puede cambiarse de lugar');

-- ---------------------------------------------------------------------------
-- Tablas secretas
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select throws_ok('select * from public.match_admin_secrets', '42501', null,
  'ni siquiera el admin puede leer los hashes de tokens');
select throws_ok('select * from public.match_viewers', '42501', null,
  'match_viewers no es accesible directamente');

-- ---------------------------------------------------------------------------
-- Admin
-- ---------------------------------------------------------------------------
select lives_ok(
  format($$insert into public.match_players (match_id, user_id, name, team, slot)
           values (%L, null, 'Pedro', 'A', 1)$$,
         (select v from ctx where k = 'id')),
  'el admin puede agregar a alguien que no usa la app (user_id null)');

delete from public.match_players where user_id = '00000000-0000-0000-0000-00000000000b';
reset role;
select is(
  (select count(*)::int from public.match_players
   where user_id = '00000000-0000-0000-0000-00000000000b'),
  0, 'el admin puede sacar a otro jugador');

select pg_temp.login('00000000-0000-0000-0000-00000000000c');
select throws_ok(
  format($$select public.reset_team_layout(%L, 'A')$$, (select v from ctx where k = 'id')),
  '42501', 'not_admin', 'alguien que no es admin no puede restablecer posiciones');
select is(public.claim_admin((select v from ctx where k = 'id'), 'token-incorrecto'), false,
  'claim_admin con un token incorrecto devuelve false');
select is((select count(*)::int from public.match_admins), 0,
  '... y no te hace admin');
select is(
  public.claim_admin((select v from ctx where k = 'id'), (select v from ctx where k = 'admin_token')),
  true, 'claim_admin con el token correcto devuelve true');
select is(
  (select count(*)::int from public.match_admins where match_id = (select v from ctx where k = 'id')),
  1, '... y Caro pasa a ser admin (solo ve su propia fila de match_admins)');
reset role;

select * from finish();
rollback;
