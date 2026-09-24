/**
 * Traduce errores de Supabase a mensajes para la persona.
 *
 * - PostgREST devuelve { code, message }. Los triggers y RPC de este proyecto
 *   lanzan code "P0001" con un `message` corto y estable (match_closed...).
 * - Una violación de UNIQUE llega como code "23505" y el nombre de la
 *   constraint dentro del mensaje: así distinguimos "lugar ocupado" de
 *   "ya estás anotado".
 * - Supabase Auth devuelve { status, code } (ej. 429 por rate limit).
 */

type AnyError = { code?: string; message?: string; status?: number; name?: string } | null | undefined;

const BY_MESSAGE: Record<string, string> = {
  match_closed: "Las inscripciones ya cerraron: el partido empezó.",
  bench_full: "El banco de ese equipo está lleno (máximo 6).",
  rate_limited: "Creaste muchos partidos seguidos. Probá de nuevo mañana.",
  invalid_starts_at: "La fecha tiene que ser futura y dentro del próximo año.",
  invalid_timezone: "No pudimos reconocer tu zona horaria.",
  slot_out_of_range: "Ese lugar no existe en este formato.",
  match_not_found: "Este partido no existe o ya se borró.",
  not_admin: "Solo el organizador puede hacer eso.",
  not_authenticated: "Se perdió tu sesión. Recargá la página.",
  invalid_layout: "No se pudieron guardar las posiciones.",
};

export const SLOT_TAKEN_MESSAGE = "Ese lugar lo acaba de ocupar otra persona. Elegí otro.";

export function errorKind(err: AnyError): "slot_taken" | "already_joined" | "other" {
  if (err?.code === "23505") {
    if (err.message?.includes("match_players_slot_key")) return "slot_taken";
    if (err.message?.includes("match_players_user_key")) return "already_joined";
  }
  return "other";
}

export function errorMessage(err: AnyError): string {
  if (!err) return "Algo salió mal. Probá de nuevo.";

  const kind = errorKind(err);
  if (kind === "slot_taken") return SLOT_TAKEN_MESSAGE;
  if (kind === "already_joined") return "Ya estás anotado en este partido.";

  if (err.message && BY_MESSAGE[err.message]) return BY_MESSAGE[err.message];

  if (err.status === 429 || err.code === "over_request_rate_limit") {
    return "Demasiados intentos desde tu conexión. Esperá un rato y probá de nuevo.";
  }
  if (err.code === "23514" || err.code === "23502" || err.code === "22001") {
    return "Revisá los datos: alguno no es válido.";
  }
  if (err.code === "42501") return "No tenés permiso para hacer eso.";

  // fetch() fallido: sin conexión o el servidor no responde.
  if (err.name === "TypeError" || err.message?.toLowerCase().includes("fetch")) {
    return "No pudimos conectarnos. Revisá tu conexión y probá de nuevo.";
  }
  return "Algo salió mal. Probá de nuevo.";
}
