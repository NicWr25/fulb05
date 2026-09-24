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

/**
 * Devuelve el uid de la sesión, creando una sesión anónima si no hay.
 * Se deduplica: si dos componentes la piden a la vez, se crea UN usuario.
 */
export function ensureSession(): Promise<string> {
  pending ??= (async () => {
    const sb = supabaseBrowser();
    const { data } = await sb.auth.getSession();
    if (data.session) return data.session.user.id;
    const { data: created, error } = await sb.auth.signInAnonymously();
    if (error || !created.user) throw error ?? new Error("No se pudo iniciar sesión");
    return created.user.id;
  })().finally(() => {
    pending = null;
  });
  return pending;
}
