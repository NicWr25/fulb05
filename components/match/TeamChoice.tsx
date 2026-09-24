"use client";

import { TeamSwatch } from "@/components/ui/TeamSwatch";
import { TEAM_LABEL, type Team } from "@/lib/domain/teams";
import { cx } from "@/lib/cx";

/** Selector amplio como el de la referencia, para un jugador ya anotado. */
export function TeamChoice({ team, label, onTeam, unavailable, busy }: {
  team: Team;
  label: string;
  onTeam: (team: Team) => void;
  unavailable: (team: Team) => boolean;
  busy?: boolean;
}) {
  return <div role="group" aria-label={label} className="grid grid-cols-2 gap-2.5">
    <p aria-hidden="true" className="col-span-2 text-13 font-semibold text-ink-2">{label}</p>
    {(["A", "B"] as const).map((value) =>
      <button key={value} type="button" aria-pressed={team === value}
        onClick={() => onTeam(value)} disabled={busy || (value !== team && unavailable(value))}
        className={cx(
          "flex min-h-14 items-center justify-center gap-2.5 rounded-panel border-2 px-2 text-16 font-semibold shadow-sm disabled:opacity-50",
          team === value ? "border-ink bg-surface text-ink shadow-md" : "border-line-strong bg-cream text-ink",
        )}>
        <TeamSwatch team={value} size={20} />{TEAM_LABEL[value]}
      </button>,
    )}
  </div>;
}
