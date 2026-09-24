-- Tests de validaciones (CHECK) y límites contra abuso.
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id, aud, role, email) values
  ('00000000-0000-0000-0000-00000000000a', 'authenticated', 'authenticated', 'ana@test.local');

create function pg_temp.login(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;

-- Crea un partido con valores por defecto, cambiando lo que se pase.
create function pg_temp.new_match(
  p_format int default 5, p_venue text default 'Cancha', p_maps text default 'https://maps.app.goo.gl/abc',
  p_date date default current_date + 7, p_tz text default 'America/Montevideo',
  p_name text default 'Ana', p_title text default null
) returns text language sql as $$
  select public.create_match(p_format, p_title, p_venue, p_maps, p_date, '21:00',
                             p_tz, p_name) ->> 'id';
$$;

create temp table ctx (k text primary key, v text);
grant all on ctx to authenticated;

select pg_temp.login('00000000-0000-0000-0000-00000000000a');

-- ---------------------------------------------------------------------------
-- Datos del partido
-- ---------------------------------------------------------------------------
select throws_ok($$select pg_temp.new_match(p_format => 6)$$, '23514', null,
  'el formato solo puede ser 5 o 7');
select lives_ok($$select pg_temp.new_match(p_venue => '   ')$$,
  'el nombre de la cancha es opcional');
select throws_ok($$select pg_temp.new_match(p_venue => repeat('x', 81))$$, '23514', null,
  'la cancha tiene hasta 80 caracteres');
select throws_ok($$select pg_temp.new_match(p_name => repeat('x', 25))$$, '23514', null,
  'el nombre del organizador tiene hasta 24 caracteres');
select throws_ok($$select pg_temp.new_match(p_maps => null)$$, 'P0001', 'maps_required',
  'Google Maps es obligatorio');
select throws_ok($$select pg_temp.new_match(p_maps => 'javascript:alert(1)')$$, '23514', null,
  'el enlace de Maps no puede ser javascript:');
select throws_ok($$select pg_temp.new_match(p_maps => 'https://evil.example/maps')$$, '23514', null,
  'el enlace de Maps tiene que ser de un dominio de Google Maps');
select lives_ok($$select pg_temp.new_match(p_maps => 'https://maps.app.goo.gl/AbC123')$$,
  'un enlace corto de Google Maps es válido');
select throws_ok($$select pg_temp.new_match(p_tz => 'Marte/Olympus')$$, 'P0001', 'invalid_timezone',
  'la zona horaria tiene que existir');
select throws_ok($$select pg_temp.new_match(p_date => current_date - 1)$$, 'P0001', 'invalid_starts_at',
  'no se puede crear un partido en el pasado');

-- ---------------------------------------------------------------------------
-- Nombres de jugadores
-- ---------------------------------------------------------------------------
insert into ctx values ('id', pg_temp.new_match());
select throws_ok(
  format($$insert into public.match_players (match_id, user_id, name, team, slot)
           values (%L, '00000000-0000-0000-0000-00000000000a', E'Nico\nmalo', 'A', 0)$$,
         (select v from ctx where k = 'id')),
  '23514', null, 'un nombre no puede tener saltos de línea');

-- ---------------------------------------------------------------------------
-- Rate limit: 10 partidos por identidad cada 24 h
-- ---------------------------------------------------------------------------
-- Ya creó 3 (cancha opcional, Maps y ctx). Creamos 7 más y el 11vo falla.
select pg_temp.new_match() from generate_series(1, 7);
select throws_ok($$select pg_temp.new_match()$$, 'P0001', 'rate_limited',
  'el partido número 11 en 24 horas se rechaza');

reset role;
select * from finish();
rollback;
