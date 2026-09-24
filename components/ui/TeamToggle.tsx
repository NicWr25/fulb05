"use client";

import { cx } from "@/lib/cx";
import { TEAMS, TEAM_LABEL, type Team } from "@/lib/domain/teams";
import { TeamSwatch } from "./TeamSwatch";

/** Elegir equipo (Claros / Oscuros). */
export function TeamToggle({
  value,
  onChange,
  disabled,
}: {
  value: Team;
  onChange: (team: Team) => void;
  disabled?: boolean;
}) {
  return (
    <div role="group" aria-label="Equipo" className="grid grid-cols-2 gap-2">
      {TEAMS.map((team) => {
        const active = team === value;
        return (
          <button
            key={team}
            type="button"
            aria-pressed={active}
            disabled={disabled}
            onClick={() => onChange(team)}
            className={cx(
              "flex h-11 items-center justify-center gap-2 rounded-field bg-surface text-15 font-semibold text-ink",
              active ? "border-2 border-ink" : "border border-line-strong",
            )}
          >
            <TeamSwatch team={team} />
            {TEAM_LABEL[team]}
          </button>
        );
      })}
    </div>
  );
}
