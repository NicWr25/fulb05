-- =============================================================================
-- Etapa (h) · Expiración: borrar partidos viejos y usuarios anónimos huérfanos
-- =============================================================================
--
-- pg_cron es un planificador de tareas DENTRO de Postgres (como el cron de
-- Unix): no hace falta un servidor propio ni una función serverless para
-- limpiar datos. Supabase lo trae disponible; acá se habilita y se agenda.
--
-- La lógica vive en private.purge_expired() y el cron solo la llama. Así se
-- puede testear con pgTAP (y correr a mano) sin esperar al horario del cron.

create extension if not exists pg_cron with schema pg_catalog;

-- -----------------------------------------------------------------------------
-- private.purge_expired()
-- -----------------------------------------------------------------------------
-- 1. Partidos que empezaron hace más de 7 días. ON DELETE CASCADE se lleva
--    jugadores, admins, viewers y el hash del token. Usa el índice
--    matches_starts_at_idx (etapa b): no recorre toda la tabla.
-- 2. Usuarios ANÓNIMOS de más de 30 días que ya no participan de ningún
--    partido (ni como admin ni como jugador). Sin esto auth.users crece para
--    siempre: cada navegador que abre un link crea uno.
--    Si alguno vuelve con su sesión vieja, el cliente lo detecta
--    (ensureSession → auth.getUser()) y crea una sesión nueva.
--
-- Devuelve cuántas filas borró (útil para el historial de cron y los tests).
create function private.purge_expired(
  p_match_age interval default interval '7 days',
  p_user_age  interval default interval '30 days'
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_matches int;
  v_users   int;
begin
  delete from public.matches m
   where m.starts_at < now() - p_match_age;
  get diagnostics v_matches = row_count;

  delete from auth.users u
   where u.is_anonymous
     and u.created_at < now() - p_user_age
     and not exists (select 1 from public.match_admins a where a.user_id = u.id)
     and not exists (select 1 from public.match_players p where p.user_id = u.id);
  get diagnostics v_users = row_count;

  return jsonb_build_object('matches', v_matches, 'anonymous_users', v_users);
end;
$$;

revoke all on function private.purge_expired(interval, interval) from public;

-- -----------------------------------------------------------------------------
-- Agenda: todos los días a las 07:15 UTC (04:15 en Uruguay, cuando nadie juega).
-- cron.schedule con un nombre existente ACTUALIZA el job en vez de duplicarlo,
-- así esta migración se puede aplicar de nuevo sin efectos raros.
-- -----------------------------------------------------------------------------
select cron.schedule(
  'fulb05-purge-expired',
  '15 7 * * *',
  $$select private.purge_expired()$$
);

-- Índices para las subconsultas de "¿participa de algún partido?" sobre
-- user_id (las PK de estas tablas empiezan por match_id, no sirven para esto).
-- También aceleran el ON DELETE CASCADE / SET NULL al borrar un usuario.
create index match_admins_user_id_idx on public.match_admins (user_id);
create index match_viewers_user_id_idx on public.match_viewers (user_id);
create index match_players_user_id_idx on public.match_players (user_id) where user_id is not null;
