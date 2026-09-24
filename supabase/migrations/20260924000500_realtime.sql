-- =============================================================================
-- Etapa (b) · 5/5 · Realtime
-- =============================================================================
--
-- Supabase Realtime (postgres_changes) lee el WAL de Postgres a través de la
-- publicación `supabase_realtime`. Solo emite cambios de las tablas agregadas acá.
--
-- Seguridad: antes de mandarle un INSERT/UPDATE a un suscriptor, Realtime
-- verifica con SU JWT que la política SELECT le permita ver esa fila. Por eso
-- "el link es la llave" también protege el canal en vivo.
--
-- Ojo con DELETE: esos eventos NO pasan por RLS ni por filtros de columna y
-- solo traen la clave primaria (con la replica identity por defecto). No
-- filtran datos (solo un UUID), pero el cliente no puede confiar en que
-- pertenezcan a su partido: por eso, ante cualquier evento, vuelve a pedir
-- el estado (ver lib/hooks/useMatch.ts, etapa e).

alter publication supabase_realtime add table public.matches, public.match_players;
