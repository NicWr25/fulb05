import type { Format, Team } from "./teams";

/**
 * Posiciones en la cancha.
 *
 * Sistema de coordenadas "canónico" (el que se guarda en matches.layout):
 * la cancha APAISADA, en porcentaje.
 *   x: a lo largo, 0 = arco de Claros (A), 100 = arco de Oscuros (B)
 *   y: a lo ancho, 0 = arriba, 100 = abajo
 *
 * En escritorio la cancha se dibuja así tal cual. En el celular se dibuja
 * PARADA, con Claros defendiendo el arco de abajo: ver toScreen().
 */
export type Point = { x: number; y: number };
export type Role = "ARQ" | "DEF" | "MED" | "DEL";
export type Layout = Record<Team, Point[]>;
export type Orientation = "vertical" | "horizontal";

export const ROLE_NAME: Record<Role, string> = {
  ARQ: "arquero",
  DEF: "defensa",
  MED: "mediocampo",
  DEL: "delantero",
};

/**
 * Formación por defecto de cada formato (jugadores de campo por línea,
 * de atrás hacia adelante). El arquero va aparte.
 * No hay selector de formaciones en el MVP: cada jugador acomoda su ficha
 * arrastrándola (dentro de su mitad), y el organizador puede acomodar todas.
 */
export const DEFAULT_FORMATION: Record<Format, readonly number[]> = {
  5: [2, 2],
  7: [3, 2, 1],
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Rol de cada lugar (slot) según la formación: 0 = ARQ, después línea por línea. */
export function slotRoles(format: Format): Role[] {
  const lines = DEFAULT_FORMATION[format];
  const roles: Role[] = ["ARQ"];
  lines.forEach((count, i) => {
    const role: Role = i === 0 ? "DEF" : i === lines.length - 1 ? "DEL" : "MED";
    for (let j = 0; j < count; j++) roles.push(role);
  });
  return roles;
}

/**
 * Disposición por defecto de un equipo (mismo algoritmo que los prototipos):
 * arquero en x = 5.5; las líneas se reparten entre x = 17 y x = 42, y los
 * jugadores de cada línea se distribuyen parejo a lo ancho, entre y = 15 y 85.
 * El equipo B es el espejo de A.
 */
export function defaultTeamLayout(format: Format, team: Team): Point[] {
  const lines = DEFAULT_FORMATION[format];
  const points: Point[] = [{ x: 5.5, y: 50 }];
  lines.forEach((count, i) => {
    const x = lines.length === 1 ? 30 : 17 + i * (25 / (lines.length - 1));
    for (let j = 0; j < count; j++) {
      // Redondeo a 2 decimales: igual que private.default_team_layout() en SQL.
      points.push({ x: round2(x), y: round2(15 + ((j + 0.5) * 70) / count) });
    }
  });
  return team === "B" ? points.map((p) => ({ x: 100 - p.x, y: p.y })) : points;
}

export function defaultLayout(format: Format): Layout {
  return { A: defaultTeamLayout(format, "A"), B: defaultTeamLayout(format, "B") };
}

/** El layout guardado si es válido para el formato; si no, el de por defecto. */
export function resolveLayout(format: Format, saved: Layout | null | undefined): Layout {
  if (saved && saved.A?.length === format && saved.B?.length === format) return saved;
  return defaultLayout(format);
}

/**
 * Coordenadas canónicas -> posición en pantalla (left/top en %).
 * Vertical (celular): lo ancho pasa a ser horizontal, y lo largo se invierte
 * para que el arco de Claros (x = 0) quede ABAJO (top = 100%).
 */
export function toScreen(p: Point, orientation: Orientation): { left: number; top: number } {
  return orientation === "horizontal" ? { left: p.x, top: p.y } : { left: p.y, top: 100 - p.x };
}

/** Inversa de toScreen: se usa al soltar una ficha arrastrada. */
export function fromScreen(left: number, top: number, orientation: Orientation): Point {
  return orientation === "horizontal" ? { x: left, y: top } : { x: 100 - top, y: left };
}

export const clampPercent = (n: number, min = 3, max = 97) => Math.min(max, Math.max(min, n));

/**
 * Mitad de la cancha de cada equipo (en x canónica): Claros juegan en x ≤ 50,
 * Oscuros en x ≥ 50. Misma regla que private.in_own_half() en la base.
 */
export const MIDFIELD = 50;

export function inOwnHalf(team: Team, p: Point): boolean {
  return team === "A" ? p.x <= MIDFIELD : p.x >= MIDFIELD;
}

/**
 * Lleva un punto al área permitida para ese equipo: dentro de la cancha y
 * sin cruzar la mitad. Se usa MIENTRAS se arrastra, así la ficha "frena" en
 * la línea del medio en vez de dejarte soltarla del otro lado.
 */
export function clampToHalf(team: Team, p: Point): Point {
  const x = clampPercent(p.x);
  return {
    x: team === "A" ? Math.min(x, MIDFIELD) : Math.max(x, MIDFIELD),
    y: clampPercent(p.y),
  };
}

/** Iniciales para la ficha: "Nico" -> "NI", "Juan Pérez" -> "JP". */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  const first = [...parts[0]];
  if (parts.length === 1) return (first[0] + (first[1] ?? "")).toUpperCase();
  return (first[0] + [...parts[parts.length - 1]][0]).toUpperCase();
}
