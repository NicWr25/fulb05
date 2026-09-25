import type { Match, Player } from "./match";
import { resolveLayout, type Point } from "./positions";

type PitchState = Pick<Match, "format" | "layout" | "players">;
export type SwapMove = { id: string; from: Point };

/** Reconoce solo un intercambio recíproco, sin confundirlo con altas o cambios individuales. */
export function detectSwap(previous: PitchState, next: PitchState): SwapMove[] {
  const oldById = new Map(previous.players.map((player) => [player.id, player]));
  const changed = next.players.flatMap((player) => {
    const old = oldById.get(player.id);
    return old && (old.team !== player.team || old.slot !== player.slot)
      ? [{ old, player }]
      : [];
  });
  if (changed.length !== 2) return [];
  const [first, second] = changed as [
    { old: Player; player: Player },
    { old: Player; player: Player },
  ];
  if (first.old.team === second.old.team ||
      first.player.team !== second.old.team || first.player.slot !== second.old.slot ||
      second.player.team !== first.old.team || second.player.slot !== first.old.slot) return [];

  const layout = resolveLayout(previous.format, previous.layout);
  return changed.map(({ old }) => ({ id: old.id, from: layout[old.team][old.slot] }));
}
