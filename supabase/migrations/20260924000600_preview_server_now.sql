-- =============================================================================
-- Etapa (d) · get_match_preview devuelve también la hora del servidor
-- =============================================================================
--
-- La página necesita saber si el partido "ya empezó" para mostrarlo cerrado.
-- El reloj que manda es el de Postgres (el trigger que bloquea inscripciones
-- usa now()), así que la hora se pide a la base en vez de usar la del
-- servidor de Next.js o la del celular, que pueden estar desfasadas.
--
-- Migración nueva (y no una edición de la anterior): una migración que ya se
-- commiteó puede estar aplicada en otro entorno y no se vuelve a correr.

create or replace function public.get_match_preview(p_match_id text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id',             m.id,
    'format',         m.format,
    'title',          m.title,
    'venue',          m.venue,
    'maps_url',       m.maps_url,
    'starts_at',      m.starts_at,
    'timezone',       m.timezone,
    'organizer_name', m.organizer_name,
    'layout',         m.layout,
    'server_now',     now(),
    'players', coalesce((
      select jsonb_agg(
               jsonb_build_object('id', p.id, 'name', p.name, 'team', p.team, 'slot', p.slot)
               order by p.team, p.slot nulls last, p.bench_since)
      from public.match_players p
      where p.match_id = m.id
    ), '[]'::jsonb)
  )
  from public.matches m
  where m.id = p_match_id;
$$;

-- `create or replace` conserva los permisos existentes (anon + authenticated).
