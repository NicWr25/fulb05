import { slotsByTeam, type Match } from "@/lib/domain/match";
import { TEAM_LABEL, type Team } from "@/lib/domain/teams";

/** La cuenta queda fuera de la cancha para que solo haya fichas ocupadas dentro. */
export function ShirtRow({ match, team }: {
  match: Pick<Match, "format" | "players">;
  team: Team;
}) {
  const slots = slotsByTeam(match)[team];
  const count = slots.filter(Boolean).length;

  return (
    <div className="flex items-center justify-center gap-3 text-12 font-semibold text-ink-2"
      role="img" aria-label={`${TEAM_LABEL[team]}: ${count} de ${match.format} jugadores`}>
      <span className="w-19 text-right">{TEAM_LABEL[team]} {count}/{match.format}</span>
      <div className="flex items-center gap-1.5" aria-hidden="true">
        {slots.map((player, slot) => (
          <svg key={slot} viewBox="0 0 24 24" width="25" height="25"
            fill={player ? `var(--color-team-${team.toLowerCase()})` : "none"}
            stroke={player ? "var(--color-ink)" : "var(--color-ink-4)"}
            strokeWidth="1.6" strokeLinejoin="round"
            strokeDasharray={player ? undefined : "2 2"}>
            <path d="M8 3 5 4 2 8l3 3 2-2v11h10V9l2 2 3-3-3-4-3-1-2 2h-4L8 3Z" />
          </svg>
        ))}
      </div>
    </div>
  );
}
