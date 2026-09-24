import type { Layout } from "./positions";
import type { Format, Team } from "./teams";

/** Un jugador tal como lo devuelve get_match_preview o la tabla match_players. */
export type Player = {
  id: string;
  name: string;
  alias?: string | null;
  team: Team;
  slot: number;
  /** Solo disponible con sesión (lectura directa de la tabla); el preview del servidor no lo trae. */
  user_id?: string | null;
};

/** Resultado de la RPC get_match_preview (jsonb). */
export type Match = {
  id: string;
  format: Format;
  title: string | null;
  venue: string | null;
  maps_url: string | null;
  starts_at: string;
  timezone: string;
  organizer_name: string;
  layout: Layout | null;
  players: Player[];
  created_by?: string | null;
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

/** Etiquetas de cancha. Si dos jugadores del mismo equipo se ven iguales,
 * el número de lugar va al principio para que no se pierda al truncar el texto. */
export function playerDisplayName(player: Player, players: Player[]): string {
  const name = player.alias || player.name;
  const normalize = (value: string) => value.trim().replace(/\s+/g, " ").toLocaleLowerCase("es");
  const duplicate = players.some((other) => other.id !== player.id && other.team === player.team &&
    normalize(other.alias || other.name) === normalize(name));
  return duplicate ? `${player.slot + 1} · ${name}` : name;
}

export function hasNameInTeam(name: string, team: Team, players: Player[]): boolean {
  const normalized = name.trim().replace(/\s+/g, " ").toLocaleLowerCase("es");
  return players.some((player) => player.team === team &&
    player.name.trim().replace(/\s+/g, " ").toLocaleLowerCase("es") === normalized);
}

/** Cuántos lugares libres quedan en la cancha (entre los dos equipos). */
export function missingCount(match: Pick<Match, "format" | "players">): number {
  return Math.max(0, match.format * 2 - match.players.length);
}

export function missingLabel(missing: number): string {
  if (missing === 0) return "¡Equipos completos!";
  return missing === 1 ? "Falta 1 jugador" : `Faltan ${missing} jugadores`;
}
