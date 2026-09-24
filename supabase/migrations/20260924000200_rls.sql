-- =============================================================================
-- Etapa (b) · 2/5 · Row Level Security
-- =============================================================================
--
-- Modelo: "el link es la llave".
-- Un SELECT abierto (`using (true)`) permitiría que cualquiera con la anon key
-- haga `select * from matches` y liste TODOS los partidos. En cambio, para ver
-- un partido primero hay que llamar a open_match(id), que solo funciona si
-- conocés el ID, y te registra en match_viewers. Las políticas exigen eso.
-- Funciona con Realtime: postgres_changes evalúa estas mismas políticas con
-- el JWT de cada suscriptor.
--
-- Nota de rendimiento: se usa `(select auth.uid())` en lugar de `auth.uid()`.
-- Envuelto en un subselect, Postgres lo evalúa UNA vez por consulta (initPlan)
-- en lugar de una vez por fila.

-- -----------------------------------------------------------------------------
-- Funciones auxiliares
-- -----------------------------------------------------------------------------
-- Son SECURITY DEFINER (corren con los permisos del dueño, que saltea RLS)
-- por dos motivos:
--   1. match_viewers no tiene permisos para el usuario, pero la política
--      necesita consultarla.
--   2. Evita recursión: una política de match_admins que consultara
--      match_admins volvería a disparar su propia política.
-- `set search_path = ''` obliga a calificar todo (public.x, auth.uid()):
-- impide que alguien "inyecte" un objeto con el mismo nombre en otro schema.
-- STABLE: dentro de una consulta, el resultado no cambia para los mismos
-- argumentos, así que el planificador puede reutilizarlo.

create function private.is_match_admin(p_match_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.match_admins a
    where a.match_id = p_match_id
      and a.user_id = (select auth.uid())
  );
$$;

create function private.can_view_match(p_match_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.match_viewers v
    where v.match_id = p_match_id
      and v.user_id = (select auth.uid())
  )
  or private.is_match_admin(p_match_id);
$$;

revoke all on function private.is_match_admin(text) from public;
revoke all on function private.can_view_match(text) from public;
grant execute on function private.is_match_admin(text) to authenticated;
grant execute on function private.can_view_match(text) to authenticated;

-- -----------------------------------------------------------------------------
-- matches: solo lectura para quien abrió el link
-- -----------------------------------------------------------------------------
create policy "matches: leer si abriste el link"
  on public.matches for select
  to authenticated
  using (private.can_view_match(id));

-- (Sin políticas de INSERT/UPDATE/DELETE: tampoco hay GRANTs. Se escribe por RPC.)

-- -----------------------------------------------------------------------------
-- match_players
-- -----------------------------------------------------------------------------
create policy "match_players: leer si abriste el link"
  on public.match_players for select
  to authenticated
  using (private.can_view_match(match_id));

-- Anotarse: solo como uno mismo (user_id = mi uid). La única excepción es el
-- organizador agregando a alguien que no usa la app (user_id null).
create policy "match_players: anotarse como uno mismo, o el admin sin user_id"
  on public.match_players for insert
  to authenticated
  with check (
    private.can_view_match(match_id)
    and (
      user_id = (select auth.uid())
      or (user_id is null and private.is_match_admin(match_id))
    )
  );

-- Cambiarse de lugar o de nombre: solo la propia inscripción.
-- USING filtra qué filas puede tocar; WITH CHECK valida cómo quedan.
-- (El grant por columna ya impide cambiar match_id/user_id; esto es la 2da capa.)
create policy "match_players: modificar solo la propia"
  on public.match_players for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Bajarse: la propia. El admin puede sacar a cualquiera de su partido.
create policy "match_players: borrar la propia, o cualquiera si sos admin"
  on public.match_players for delete
  to authenticated
  using (
    user_id = (select auth.uid())
    or private.is_match_admin(match_id)
  );

-- -----------------------------------------------------------------------------
-- match_admins: cada uno ve solo sus filas ("¿soy admin de este partido?")
-- -----------------------------------------------------------------------------
create policy "match_admins: ver las propias"
  on public.match_admins for select
  to authenticated
  using (user_id = (select auth.uid()));

-- match_admin_secrets y match_viewers: RLS activado y NINGUNA política.
-- Sin política, RLS deniega todo por defecto; solo las funciones security
-- definer (que corren como el dueño de la tabla) pueden leerlas o escribirlas.
