-- =============================================================================
-- Etapa (b) · 1/5 · Esquema: tablas, restricciones e índices
-- =============================================================================
--
-- Tablas:
--   matches              el partido (datos públicos para quien tenga el link)
--   match_players        inscripciones (slot null = banco de suplentes)
--   match_admins         quién administra cada partido (por auth.uid())
--   match_admin_secrets  hash del token de administrador (nadie la lee directo)
--   match_viewers        quién abrió el link: "el link es la llave" (ver 2/5)
--
-- Las funciones auxiliares van en el schema `private`, que PostgREST NO expone
-- como RPC: así no quedan funciones internas invocables desde el navegador.

create schema if not exists private;
revoke all on schema private from public;
-- Las políticas RLS llaman a funciones de `private`; quien ejecuta la consulta
-- necesita USAGE sobre el schema (y EXECUTE sobre cada función, ver 2/5).
grant usage on schema private to authenticated;

-- -----------------------------------------------------------------------------
-- Validación del layout (posiciones arrastradas por el organizador)
-- -----------------------------------------------------------------------------
-- Formato: {"A": [{"x": 5.5, "y": 50}, ...], "B": [...]}, un punto por lugar,
-- en % sobre la cancha apaisada (x a lo largo, 0 = arco de Claros; y a lo ancho).
-- Es plpgsql (y no SQL puro) porque en SQL el AND no garantiza cortocircuito:
-- jsonb_array_elements() sobre algo que no es array tiraría error en vez de false.
create function private.is_valid_layout(p_layout jsonb, p_format smallint)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_team text;
  v_point jsonb;
begin
  if jsonb_typeof(p_layout) <> 'object'
     or (select count(*) from jsonb_object_keys(p_layout)) <> 2
     or not (p_layout ? 'A' and p_layout ? 'B') then
    return false;
  end if;

  foreach v_team in array array['A', 'B'] loop
    if jsonb_typeof(p_layout -> v_team) <> 'array'
       or jsonb_array_length(p_layout -> v_team) <> p_format then
      return false;
    end if;

    for v_point in select value from jsonb_array_elements(p_layout -> v_team) loop
      if jsonb_typeof(v_point) <> 'object'
         or (select count(*) from jsonb_object_keys(v_point)) <> 2
         or jsonb_typeof(v_point -> 'x') <> 'number'
         or jsonb_typeof(v_point -> 'y') <> 'number'
         or (v_point ->> 'x')::numeric not between 0 and 100
         or (v_point ->> 'y')::numeric not between 0 and 100 then
        return false;
      end if;
    end loop;
  end loop;

  return true;
end;
$$;

-- -----------------------------------------------------------------------------
-- matches
-- -----------------------------------------------------------------------------
create table public.matches (
  -- 8 caracteres de un alfabeto sin ambiguos (sin i, l, o, 0, 1): 31^8 ≈ 8,5·10¹¹.
  -- Como el ID es la credencial para leer el partido, tiene que ser difícil de adivinar.
  id             text primary key
                 check (id ~ '^[a-hjkmnp-z2-9]{8}$'),
  format         smallint not null check (format in (5, 7)),
  -- Textos: largo acotado, sin espacios en los bordes ni caracteres de control
  -- (saltos de línea, etc.), que romperían el layout o el texto de Open Graph.
  title          text check (
                   title is null
                   or (char_length(title) between 1 and 60
                       and title = btrim(title) and title !~ '[[:cntrl:]]')),
  venue          text not null check (
                   char_length(venue) between 1 and 80
                   and venue = btrim(venue) and venue !~ '[[:cntrl:]]'),
  -- Solo https y solo dominios de Google Maps: bloquea `javascript:` y
  -- enlaces arbitrarios (phishing) en un <a href> que ve todo el grupo.
  maps_url       text check (
                   maps_url is null
                   or (char_length(maps_url) <= 500
                       and maps_url ~* '^https://(maps\.app\.goo\.gl|goo\.gl/maps|(www\.)?google\.[a-z.]+/maps|maps\.google\.[a-z.]+)([/?#]|$)')),
  -- Instante absoluto + zona IANA del creador: "21:00" se muestra igual para
  -- todos (y en el servidor que arma el Open Graph, que corre en UTC).
  starts_at      timestamptz not null,
  timezone       text not null check (char_length(timezone) between 1 and 64),
  organizer_name text not null check (
                   char_length(organizer_name) between 1 and 24
                   and organizer_name = btrim(organizer_name)
                   and organizer_name !~ '[[:cntrl:]]'),
  -- null = disposición por defecto del formato.
  layout         jsonb check (layout is null or private.is_valid_layout(layout, format)),
  created_by     uuid references auth.users (id) on delete set null,
  created_at     timestamptz not null default now()
);

comment on table public.matches is
  'Partidos. Solo se modifican vía funciones RPC (create_match, update_match, set_layout).';

-- Para el purgado diario de partidos viejos (pg_cron, etapa h):
-- `delete ... where starts_at < now() - interval '7 days'` usa este índice.
create index matches_starts_at_idx on public.matches (starts_at);

-- Para el rate limit de create_match: "¿cuántos partidos creó este uid en 24 h?"
create index matches_created_by_created_at_idx on public.matches (created_by, created_at);

-- -----------------------------------------------------------------------------
-- match_players
-- -----------------------------------------------------------------------------
create table public.match_players (
  id          uuid primary key default gen_random_uuid(),
  match_id    text not null references public.matches (id) on delete cascade,
  -- null = jugador agregado por el organizador (alguien que no usa la app).
  user_id     uuid references auth.users (id) on delete set null,
  name        text not null check (
                char_length(name) between 1 and 24
                and name = btrim(name) and name !~ '[[:cntrl:]]'),
  team        text not null check (team in ('A', 'B')),
  -- 0 = arquero, 1..N-1 = jugadores de campo. null = banco de suplentes.
  -- El límite superior real (slot < format) necesita mirar otra tabla, y un
  -- CHECK no puede hacerlo: lo valida un trigger (ver 3/5).
  slot        smallint check (slot between 0 and 6),
  -- Orden de llegada al banco (no la fecha de inscripción): quien pasa al banco
  -- se pone al final de la fila. Lo mantiene un trigger.
  bench_since timestamptz,
  created_at  timestamptz not null default now(),

  -- Resuelve la concurrencia: si dos personas eligen el mismo lugar a la vez,
  -- la segunda recibe un error 23505 con este nombre de constraint.
  -- En Postgres los NULL son distintos entre sí, así que el banco (slot null)
  -- admite muchas filas sin necesitar un índice parcial.
  -- Además, como match_id es la columna líder, este índice sirve para
  -- `where match_id = ?` y no hace falta otro índice sobre match_id.
  constraint match_players_slot_key unique (match_id, team, slot),

  -- Una inscripción por persona y partido. Los user_id null (agregados por el
  -- organizador) no chocan entre sí, por la misma regla de los NULL.
  constraint match_players_user_key unique (match_id, user_id),

  constraint match_players_bench_since_chk
    check ((slot is null) = (bench_since is not null))
);

-- -----------------------------------------------------------------------------
-- Administración
-- -----------------------------------------------------------------------------
create table public.match_admins (
  match_id   text not null references public.matches (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (match_id, user_id)
);

-- Tabla aparte (y no una columna en matches) porque RLS filtra FILAS, no
-- columnas: si el hash viviera en matches, saldría en cada `select *` y en
-- cada evento de Realtime. Esta tabla tiene RLS y ninguna política: solo la
-- leen funciones security definer.
create table public.match_admin_secrets (
  match_id   text primary key references public.matches (id) on delete cascade,
  token_hash bytea not null check (octet_length(token_hash) = 32) -- SHA-256
);

-- "El link es la llave": solo quien abrió el link (open_match) puede leer el partido.
create table public.match_viewers (
  match_id   text not null references public.matches (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (match_id, user_id)
);

-- -----------------------------------------------------------------------------
-- Permisos de tabla (GRANTs)
-- -----------------------------------------------------------------------------
-- Supabase, por defecto, da TODOS los permisos a anon y authenticated sobre
-- cada tabla nueva de `public`. RLS igual filtra, pero preferimos partir de
-- cero y dar solo lo necesario: dos capas (GRANT decide QUÉ operaciones y
-- columnas; RLS decide sobre QUÉ filas).
revoke all on public.matches, public.match_players, public.match_admins,
              public.match_admin_secrets, public.match_viewers
  from anon, authenticated;

-- matches: solo lectura. Toda escritura pasa por RPC.
grant select on public.matches to authenticated;

-- match_players: lectura, alta y baja directas (RLS decide sobre qué filas).
-- INSERT/UPDATE con grant POR COLUMNA: nadie puede escribir id, bench_since ni
-- created_at, y en un UPDATE nadie puede cambiar match_id ni user_id (o sea,
-- no puede "adueñarse" de la inscripción de otro ni moverla a otro partido).
grant select, delete on public.match_players to authenticated;
grant insert (match_id, user_id, name, team, slot) on public.match_players to authenticated;
grant update (name, team, slot) on public.match_players to authenticated;

-- match_admins: cada uno puede ver sus propias filas (para saber si es admin).
grant select on public.match_admins to authenticated;

-- match_admin_secrets y match_viewers: sin permisos directos.

-- anon (sin sesión) no tiene permisos sobre ninguna tabla: el render del
-- servidor usa la función get_match_preview (ver 4/5).

alter table public.matches             enable row level security;
alter table public.match_players       enable row level security;
alter table public.match_admins        enable row level security;
alter table public.match_admin_secrets enable row level security;
alter table public.match_viewers       enable row level security;
