-- Tests de las reglas de dominio (triggers): primer lugar libre, banco con
-- ascenso automático, tope del banco, cierre a la hora de inicio y
-- reacomodo al cambiar el formato.
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

-- Ana (admin) + 8 jugadores: u1..u8.
insert into auth.users (id, aud, role, email)
select ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
       'authenticated', 'authenticated', 'u' || n || '@test.local'
from generate_series(0, 8) as n;

create function pg_temp.uid(n int) returns uuid language sql as $$
  select ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid;
$$;

create function pg_temp.login(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;

create temp table ctx (k text primary key, v text);
grant all on ctx to authenticated;

-- Anota a uN con slot null ("primer lugar libre, o banco").
create function pg_temp.join_auto(n int, p_team text) returns void language plpgsql as $$
begin
  perform pg_temp.login(pg_temp.uid(n));
  perform public.open_match((select v from ctx where k = 'id'));
  insert into public.match_players (match_id, user_id, name, team, slot)
  values ((select v from ctx where k = 'id'), pg_temp.uid(n), 'Jugador ' || n, p_team, null);
  reset role;
end;
$$;

create function pg_temp.slot_of(n int) returns smallint language sql as $$
  select slot from public.match_players where user_id = pg_temp.uid(n);
$$;

-- Partido de fútbol 5 creado por u0 (Ana).
select pg_temp.login(pg_temp.uid(0));
insert into ctx select 'id', public.create_match(
  5, null, 'Cancha', null, current_date + 3, '20:00', 'America/Montevideo', 'Ana') ->> 'id';
reset role;

-- ---------------------------------------------------------------------------
-- Primer lugar libre y banco
-- ---------------------------------------------------------------------------
select pg_temp.join_auto(n, 'A') from generate_series(1, 7) as n;

select results_eq(
  $$select pg_temp.slot_of(n)::int from generate_series(1, 5) n order by n$$,
  $$values (0), (1), (2), (3), (4)$$,
  'con slot null, los 5 primeros ocupan los lugares libres en orden');
select ok(pg_temp.slot_of(6) is null and pg_temp.slot_of(7) is null,
  'con el equipo lleno, el 6to y el 7mo van al banco');

-- u3 se baja: se libera el lugar 2 y entra el primero del banco (u6).
select pg_temp.login(pg_temp.uid(3));
delete from public.match_players where user_id = pg_temp.uid(3);
reset role;
select is(pg_temp.slot_of(6), 2::smallint,
  'al bajarse alguien, el primero del banco ocupa su lugar');
select ok(pg_temp.slot_of(7) is null, 'el segundo del banco sigue esperando');

-- u1 se cambia al equipo B: libera el lugar 0 de A y entra u7.
select pg_temp.login(pg_temp.uid(1));
update public.match_players set team = 'B', slot = 4 where user_id = pg_temp.uid(1);
reset role;
select is(pg_temp.slot_of(7), 0::smallint,
  'al cambiarse alguien de equipo, también asciende el banco');

-- Llegada al banco: el banco se ordena por bench_since, no por inscripción.
-- u8 entra a A (lleno) -> banco. Después u2 se pasa a B y deja libre su lugar:
-- asciende u8 (el único del banco).
select pg_temp.join_auto(8, 'A');
select ok(pg_temp.slot_of(8) is null, 'u8 entra al banco de A');

-- ---------------------------------------------------------------------------
-- Tope del banco: 6 por equipo
-- ---------------------------------------------------------------------------
select pg_temp.login(pg_temp.uid(0));
insert into public.match_players (match_id, user_id, name, team, slot)
select (select v from ctx where k = 'id'), null, 'Suplente ' || n, 'A', null
from generate_series(1, 5) as n;
select throws_ok(
  format($$insert into public.match_players (match_id, user_id, name, team, slot)
           values (%L, null, 'Uno más', 'A', null)$$, (select v from ctx where k = 'id')),
  'P0001', 'bench_full', 'el banco admite hasta 6 por equipo');
reset role;

-- ---------------------------------------------------------------------------
-- Cambio de formato 5 -> 7 -> 5
-- ---------------------------------------------------------------------------
-- Estado de A: 5 titulares + 6 en el banco (u8 primero).
select pg_temp.login(pg_temp.uid(0));
select public.update_match((select v from ctx where k = 'id'), 7, null, 'Cancha', null,
  current_date + 3, '20:00', 'America/Montevideo', 'Ana');
reset role;
select is(pg_temp.slot_of(8), 5::smallint,
  'al pasar a fútbol 7, los lugares nuevos se llenan desde el banco (u8 primero)');
select is(
  (select count(*)::int from public.match_players
   where match_id = (select v from ctx where k = 'id') and team = 'A' and slot is not null),
  7, 'A queda con 7 titulares');

select pg_temp.login(pg_temp.uid(0));
select public.update_match((select v from ctx where k = 'id'), 5, null, 'Cancha', null,
  current_date + 3, '20:00', 'America/Montevideo', 'Ana');
reset role;
select is(
  (select count(*)::int from public.match_players
   where match_id = (select v from ctx where k = 'id') and team = 'A' and slot is not null),
  5, 'al volver a fútbol 5, A queda con 5 titulares');
select results_eq(
  $$select name from public.match_players
    where match_id = (select v from ctx where k = 'id') and team = 'A' and slot is null
    order by bench_since limit 2$$,
  $$select name from public.match_players
    where match_id = (select v from ctx where k = 'id') and team = 'A'
      and user_id = pg_temp.uid(8)
    union all
    select 'Suplente 1'$$,
  'los que quedaron afuera pasan al PRINCIPIO del banco, en orden de lugar');
select is(
  (select max(slot)::int from public.match_players where match_id = (select v from ctx where k = 'id')),
  4, 'ningún jugador queda en un lugar fuera de rango');

-- ---------------------------------------------------------------------------
-- Cierre a la hora de inicio
-- ---------------------------------------------------------------------------
-- Simulamos que el partido ya empezó (como postgres, salteando las RPC).
update public.matches set starts_at = now() - interval '1 minute'
 where id = (select v from ctx where k = 'id');

select pg_temp.login(pg_temp.uid(1));
select throws_ok(
  $$delete from public.match_players where user_id = '00000000-0000-0000-0000-000000000001'$$,
  'P0001', 'match_closed', 'con el partido empezado, nadie puede bajarse');
select throws_ok(
  $$update public.match_players set slot = 0 where user_id = '00000000-0000-0000-0000-000000000001'$$,
  'P0001', 'match_closed', '... ni cambiarse de lugar');
reset role;
select pg_temp.login(pg_temp.uid(0));
select throws_ok(
  $$delete from public.match_players where user_id = '00000000-0000-0000-0000-000000000002'$$,
  'P0001', 'match_closed', '... ni el admin puede sacar gente');
select lives_ok(
  format($$select public.update_match(%L, 5, 'Reprogramado', 'Cancha', null,
           current_date + 10, '20:00', 'America/Montevideo', 'Ana')$$,
         (select v from ctx where k = 'id')),
  'el admin sí puede reprogramar el partido a una fecha futura');
reset role;

select * from finish();
rollback;
