import type { Layout } from "./positions";
import type { Format, Team } from "./teams";

/** Un jugador tal como lo devuelve get_match_preview o la tabla match_players. */
export type Player = {
  id: string;
  name: string;
  team: Team;
  /** null = banco de suplentes */
  slot: number | null;
  /** Solo disponible con sesión (lectura directa de la tabla); el preview del servidor no lo trae. */
  user_id?: string | null;
};

/** Resultado de la RPC get_match_preview (jsonb). */
export type Match = {
  id: string;
  format: Format;
  title: string | null;
  venue: string;
  maps_url: string | null;
  starts_at: string;
  timezone: string;
  organizer_name: string;
  layout: Layout | null;
  players: Player[];
};

/** IDs válidos: mismo patrón que el CHECK de matches.id. */
export const MATCH_ID_RE = /^[a-hjkmnp-z2-9]{8}$/;

/** Titulares por equipo, indexados por lugar (null = libre). */
export function slotsByTeam(match: Pick<Match, "format" | "players">): Record<Team, (Player | null)[]> {
  const slots: Record<Team, (Player | null)[]> = {
    A: Array(match.format).fill(null),
    B: Array(match.format).fill(null),
  };
  for (const p of match.players) {
    if (p.slot !== null && p.slot < match.format) slots[p.team][p.slot] = p;
  }
  return slots;
}

/** Suplentes de un equipo, en el orden en que vinieron (el servidor ya los ordena). */
export function benchOf(match: Pick<Match, "players">, team: Team): Player[] {
  return match.players.filter((p) => p.team === team && p.slot === null);
}

/** Cuántos lugares libres quedan en la cancha (entre los dos equipos). */
export function missingCount(match: Pick<Match, "format" | "players">): number {
  const onPitch = match.players.filter((p) => p.slot !== null).length;
  return Math.max(0, match.format * 2 - onPitch);
}

export function missingLabel(missing: number): string {
  if (missing === 0) return "¡Equipos completos!";
  return missing === 1 ? "Falta 1 jugador" : `Faltan ${missing} jugadores`;
}
