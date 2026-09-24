import { cache } from "react";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./env";
import { MATCH_ID_RE, type Match } from "@/lib/domain/match";

/**
 * Lectura del partido en el SERVIDOR (render inicial y Open Graph).
 * Usa la anon key y NINGUNA sesión: corre como el rol `anon`, que solo puede
 * ejecutar get_match_preview (exige conocer el ID). No hace falta @supabase/ssr
 * porque el servidor nunca actúa en nombre del usuario.
 *
 * `cache()` de React deduplica dentro de un mismo request: generateMetadata
 * y la página comparten una sola llamada.
 */
export const getMatchPreview = cache(async (id: string): Promise<Match | null> => {
  if (!MATCH_ID_RE.test(id)) return null; // ni vale la pena consultar

  const sb = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await sb.rpc("get_match_preview", { p_match_id: id });
  if (error) throw new Error(`get_match_preview falló: ${error.message}`);
  return (data as unknown as Match | null) ?? null;
});
