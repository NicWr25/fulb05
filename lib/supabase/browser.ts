"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./env";

/**
 * Cliente de Supabase para el navegador (uno solo por pestaña).
 * La sesión anónima se guarda en localStorage y se renueva sola: la misma
 * persona sigue siendo el mismo auth.uid() mientras no borre los datos del
 * navegador. (Ojo: el navegador interno de WhatsApp tiene su propio
 * localStorage, distinto del de Chrome/Safari.)
 */
let client: SupabaseClient<Database> | null = null;

export function supabaseBrowser(): SupabaseClient<Database> {
  client ??= createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
  return client;
}

let pending: Promise<string> | null = null;
/** uid ya verificado contra el servidor en esta carga de página. */
let verifiedUid: string | null = null;

/**
 * Devuelve el uid de la sesión, creando una sesión anónima si no hay.
 * Se deduplica: si dos componentes la piden a la vez, se crea UN usuario.
 *
 * Verifica la sesión guardada con el servidor (una vez por carga de página).
 * ¿Por qué? getSession() solo lee localStorage: si el usuario se borró en el
 * servidor (un `db reset` en local, o la purga de anónimos viejos en
 * producción), el JWT sigue siendo válido criptográficamente y auth.uid()
 * devuelve un id que ya no existe en auth.users. Resultado: cualquier INSERT
 * con ese id falla por clave foránea (PostgREST responde 409). getUser() le
 * pregunta al servidor de Auth; si el usuario no existe, descartamos esa
 * sesión y creamos una nueva.
 */
export function ensureSession(): Promise<string> {
  if (verifiedUid) return Promise.resolve(verifiedUid);
  pending ??= (async () => {
    const sb = supabaseBrowser();
    const { data } = await sb.auth.getSession();
    if (data.session) {
      const { data: user, error } = await sb.auth.getUser();
      if (!error && user.user) return (verifiedUid = user.user.id);
      // Sesión huérfana: se descarta solo localmente (el usuario ya no existe).
      await sb.auth.signOut({ scope: "local" });
    }
    const { data: created, error } = await sb.auth.signInAnonymously();
    if (error || !created.user) throw error ?? new Error("No se pudo iniciar sesión");
    return (verifiedUid = created.user.id);
  })().finally(() => {
    pending = null;
  });
  return pending;
}
