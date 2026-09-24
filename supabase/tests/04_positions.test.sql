-- Tests de posiciones: cada jugador mueve SU ficha, solo en SU mitad; el
-- admin mueve solo la suya; el layout existe siempre.
begin;
create extension if not exists pgtap with schema extensions;
select plan(23);

insert into auth.users (id, aud, role, email) values
  ('00000000-0000-0000-0000-00000000000a', 'authenticated', 'authenticated', 'ana@test.local'),   -- admin
  ('00000000-0000-0000-0000-00000000000b', 'authenticated', 'authenticated', 'bruno@test.local'), -- Blanco, lugar 1
  ('00000000-0000-0000-0000-00000000000c', 'authenticated', 'authenticated', 'caro@test.local');  -- solo mira

create function pg_temp.login(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;

create temp table ctx (k text primary key, v text);
grant all on ctx to authenticated;

create function pg_temp.id() returns text language sql as $$ select v from ctx where k = 'id' $$;
create function pg_temp.point(p_team text, p_slot int) returns jsonb language sql as $$
  select layout -> p_team -> p_slot from public.matches where id = pg_temp.id();
$$;

select pg_temp.login('00000000-0000-0000-0000-00000000000a');
insert into ctx select 'id', public.create_match(
  7, null, 'Cancha', 'https://maps.app.goo.gl/abc', current_date + 3, '20:00', 'America/Montevideo', 'Ana') ->> 'id';
reset role;

-- ---------------------------------------------------------------------------
-- El layout existe siempre
-- ---------------------------------------------------------------------------
select is(
  (select layout from public.matches where id = pg_temp.id()),
  private.default_layout(7::smallint),
  'un partido nuevo arranca con la disposición por defecto (no null)');
select is(pg_temp.point('A', 0), '{"x": 5.5, "y": 50}'::jsonb, 'el arquero de Claros arranca junto a su arco');

-- Bruno se anota en Claros, lugar 1; Caro solo abre el link.
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select public.open_match(pg_temp.id());
insert into public.match_players (match_id, user_id, name, team, slot)
values (pg_temp.id(), '00000000-0000-0000-0000-00000000000b', 'Bruno', 'A', 1);

-- ---------------------------------------------------------------------------
-- Cada uno mueve SU ficha
-- ---------------------------------------------------------------------------
select lives_ok(
  format($$select public.move_token(%L, 'A', 1, 30.44, 60.06)$$, pg_temp.id()),
  'Bruno mueve su propia ficha dentro de su mitad');
select is(pg_temp.point('A', 1), '{"x": 30.4, "y": 60.1}'::jsonb, '... y queda guardada (redondeada a 1 decimal)');
select throws_ok(
  format($$select public.move_token(%L, 'A', 1, 50.1, 50)$$, pg_temp.id()),
  'P0001', 'wrong_half', 'Bruno no puede pasar su ficha a la mitad de Oscuros');
select lives_ok(
  format($$select public.move_token(%L, 'A', 1, 50, 50)$$, pg_temp.id()),
  '... pero sí dejarla justo en la línea del medio');
select throws_ok(
  format($$select public.move_token(%L, 'A', 2, 20, 20)$$, pg_temp.id()),
  '42501', 'not_your_token', 'Bruno no puede mover un lugar libre');
select throws_ok(
  format($$select public.move_token(%L, 'A', 1, 120, 50)$$, pg_temp.id()),
  'P0001', 'invalid_layout', 'coordenadas fuera de la cancha se rechazan');
select throws_ok(
  format($$select public.move_token(%L, 'A', 7, 20, 20)$$, pg_temp.id()),
  'P0001', 'slot_out_of_range', 'en fútbol 7 no existe el lugar 7');

select pg_temp.login('00000000-0000-0000-0000-00000000000c');
select public.open_match(pg_temp.id());
select throws_ok(
  format($$select public.move_token(%L, 'A', 1, 20, 20)$$, pg_temp.id()),
  '42501', 'not_your_token', 'Caro no puede mover la ficha de Bruno');

-- ---------------------------------------------------------------------------
-- El admin mueve cualquier ficha ocupada y respeta las mitades
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select throws_ok(
  format($$select public.move_token(%L, 'B', 3, 60, 40)$$, pg_temp.id()),
  '42501', 'not_your_token', 'el admin no puede mover un lugar libre de Negro');
select throws_ok(
  format($$select public.move_token(%L, 'A', 1, 70, 40)$$, pg_temp.id()),
  'P0001', 'wrong_half', 'el admin puede mover a Bruno, pero respeta la mitad');
select lives_ok(
  format($$select public.move_token(%L, 'A', 1, 30, 40)$$, pg_temp.id()),
  'el admin acomoda la ficha de Bruno');
insert into public.match_players (match_id, user_id, name, team, slot)
values (pg_temp.id(), '00000000-0000-0000-0000-00000000000a', 'Ana', 'B', 3);
select throws_ok(
  format($$select public.move_token(%L, 'B', 3, 40, 40)$$, pg_temp.id()),
  'P0001', 'wrong_half', 'el admin tampoco puede cruzar la mitad');
select lives_ok(
  format($$select public.move_token(%L, 'B', 3, 60, 40)$$, pg_temp.id()),
  'el admin sí puede mover su propia ficha');
select is(pg_temp.point('A', 1), '{"x": 30, "y": 40}'::jsonb,
  'mover la ficha propia no pisó el movimiento de Bruno (jsonb_set cambia un solo punto)');
select lives_ok(
  format($$select public.change_player_team(%L,
    (select id from public.match_players where name = 'Bruno'), 'B')$$, pg_temp.id()),
  'el admin cambia a Bruno de equipo');
select is(
  (select team || slot from public.match_players where name = 'Bruno'),
  'B0', 'el primer lugar libre del equipo queda asignado');
select throws_ok(
  $$update public.match_players set slot = 3 where name = 'Ana'$$,
  '42501', null, 'el admin no puede cambiar un lugar por UPDATE directo');


-- ---------------------------------------------------------------------------
-- Partido empezado: nadie mueve
-- ---------------------------------------------------------------------------
reset role;
update public.matches set starts_at = now() - interval '1 minute' where id = pg_temp.id();
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select throws_ok(
  format($$select public.move_token(%L, 'B', 0, 70, 20)$$, pg_temp.id()),
  'P0001', 'match_closed', 'con el partido empezado, el jugador ya no mueve su ficha');
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select throws_ok(
  format($$select public.move_token(%L, 'B', 3, 60, 40)$$, pg_temp.id()),
  'P0001', 'match_closed', 'el admin tampoco mueve su ficha después del inicio');

-- ---------------------------------------------------------------------------
-- Restablecer y cambio de formato
-- ---------------------------------------------------------------------------
select public.reset_team_layout(pg_temp.id(), 'A');
reset role; -- private.default_team_layout no es ejecutable por `authenticated` (bien)
select is(
  (select layout -> 'A' from public.matches where id = pg_temp.id()),
  private.default_team_layout(7::smallint, 'A'),
  'reset_team_layout vuelve Claros a la disposición por defecto');

update public.matches set starts_at = now() + interval '3 days' where id = pg_temp.id();
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select public.update_match(pg_temp.id(), 5, null, 'Cancha', 'https://maps.app.goo.gl/abc', current_date + 3, '20:00', 'America/Montevideo', 'Ana');
select is(
  (select jsonb_array_length(layout -> 'B') from public.matches where id = pg_temp.id()),
  5, 'al cambiar a fútbol 5, el layout pasa a tener 5 puntos por equipo');
reset role;

select * from finish();
rollback;
