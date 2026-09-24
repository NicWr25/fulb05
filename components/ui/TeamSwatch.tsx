import { cx } from "@/lib/cx";
import { TEAM_SWATCH_CLASS, type Team } from "@/lib/domain/teams";

/** Circulito con el color del equipo. Decorativo: el nombre del equipo va al lado. */
export function TeamSwatch({ team, size = 14 }: { team: Team; size?: 12 | 14 | 20 }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        "inline-block shrink-0 rounded-full border border-swatch-border",
        size === 12 ? "size-3" : size === 20 ? "size-5" : "size-3.5",
        TEAM_SWATCH_CLASS[team],
      )}
    />
  );
}
