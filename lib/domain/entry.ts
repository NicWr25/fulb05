import type { Match, Player } from "./match";
import { resolveLayout, type Point } from "./positions";
import type { Team } from "./teams";

type PitchState = Pick<Match, "format" | "layout" | "players">;

const START: Point = { x: 50, y: 50 };
const MIN_SEPARATION = 12;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round1 = (value: number) => Math.round(value * 10) / 10;

function occupiedPoints(match: PitchState) {
  const layout = resolveLayout(match.format, match.layout);
  return match.players.map((player) => ({ player, point: layout[player.team][player.slot] }));
}

/**
 * Simulación breve y determinista de una ficha impulsada desde el centro.
 * Solo el punto final se guarda; los desplazamientos de las otras fichas son
 * una representación visual del choque.
 */
export function entryDestination(match: PitchState, team: Team): Point {
  const others = occupiedPoints(match);
  const direction = team === "A" ? -1 : 1;
  const minX = team === "A" ? 5 : 51;
  const maxX = team === "A" ? 49 : 95;
  const hits = new Set<string>();
  let { x, y } = START;
  let velocityX = direction * 2.5;
  let velocityY = 0;

  for (let frame = 0; frame < 28; frame++) {
    x = clamp(x + velocityX, minX, maxX);
    y = clamp(y + velocityY, 8, 92);
    for (const { player, point } of others) {
      const distance = Math.hypot((x - point.x) * 1.05, (y - point.y) * 0.68);
      if (distance >= 8 || hits.has(player.id)) continue;
      hits.add(player.id);
      const side = y === point.y ? (player.slot % 2 ? 1 : -1) : Math.sign(y - point.y);
      velocityY += side * 1.7;
      velocityX *= 0.82;
    }
    velocityX *= 0.945;
    velocityY *= 0.82;
  }

  // Busca el punto libre más cercano al final del impulso. En una cancha
  // angosta dos círculos de 44 px necesitan más margen que el choque inicial.
  const clear = (candidateX: number, candidateY: number) => others.every(({ point }) =>
    Math.hypot((candidateX - point.x) * 1.05, (candidateY - point.y) * 0.68) >= MIN_SEPARATION,
  );
  if (!clear(x, y)) {
    let closest = Infinity;
    let free = { x, y };
    for (let candidateX = minX; candidateX <= maxX; candidateX += 2) {
      for (let candidateY = 8; candidateY <= 92; candidateY += 2) {
        if (!clear(candidateX, candidateY)) continue;
        const distance = Math.hypot((candidateX - x) * 1.05, (candidateY - y) * 0.68);
        if (distance < closest) {
          closest = distance;
          free = { x: candidateX, y: candidateY };
        }
      }
    }
    x = free.x;
    y = free.y;
  }

  return { x: round1(x), y: round1(y) };
}

export type EntryBump = { id: string; x: number; y: number; delayMs: number };

/** Fichas cercanas al trayecto central → destino, con impulso transitorio. */
export function entryBumps(match: PitchState, newcomer: Player): EntryBump[] {
  const layout = resolveLayout(match.format, match.layout);
  const end = layout[newcomer.team][newcomer.slot];
  const spanX = (end.x - START.x) * 1.05;
  const spanY = (end.y - START.y) * 0.68;
  const lengthSquared = spanX * spanX + spanY * spanY;
  if (lengthSquared === 0) return [];

  return occupiedPoints(match).flatMap(({ player, point }) => {
    if (player.id === newcomer.id) return [];
    const dx = (point.x - START.x) * 1.05;
    const dy = (point.y - START.y) * 0.68;
    const progress = clamp((dx * spanX + dy * spanY) / lengthSquared, 0, 1);
    const nearX = START.x + (end.x - START.x) * progress;
    const nearY = START.y + (end.y - START.y) * progress;
    const awayX = (point.x - nearX) * 1.05;
    const awayY = (point.y - nearY) * 0.68;
    const distance = Math.hypot(awayX, awayY);
    if (distance >= 11) return [];
    const side = awayY === 0 ? (player.slot % 2 ? 1 : -1) : Math.sign(awayY);
    return [{
      id: player.id,
      x: round1((end.x < START.x ? -1 : 1) * 2.5 + awayX * 0.3),
      y: round1(side * (5 + (11 - distance) * 0.3)),
      delayMs: 280 + Math.round(progress * 360),
    }];
  });
}
