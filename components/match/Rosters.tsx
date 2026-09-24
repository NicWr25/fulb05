import { PlayerChip } from "@/components/ui/PlayerChip";
import { TeamSwatch } from "@/components/ui/TeamSwatch";
import { benchOf, slotsByTeam, type Match, type Player } from "@/lib/domain/match";
import { TEAMS, TEAM_LABEL } from "@/lib/domain/teams";

/** Listas de cada equipo: titulares, después suplentes. */
export function Rosters({
  match,
  meId,
  onRemove,
  removingId,
}: {
  match: Pick<Match, "format" | "players">;
  /** id de la inscripción propia (para resaltarla). */
  meId?: string | null;
  /** Si viene, muestra la X de sacar (organizador). */
  onRemove?: (player: Player) => void;
  removingId?: string | null;
}) {
  const slots = slotsByTeam(match);
  return (
    <div className="flex flex-col gap-4">
      {TEAMS.map((t) => {
        const starters = slots[t].filter((p): p is Player => p !== null);
        const bench = benchOf(match, t);
        const people = [...starters, ...bench];
        return (
          <section key={t} className="flex flex-col gap-2" aria-label={TEAM_LABEL[t]}>
            <h2 className="flex items-center gap-2">
              <TeamSwatch team={t} />
              <span className="text-15 font-semibold">{TEAM_LABEL[t]}</span>
              <span className="ml-auto text-13 font-normal text-ink-2">
                {starters.length}/{match.format}
                {bench.length > 0 && ` · ${bench.length} en el banco`}
              </span>
            </h2>
            <div className="flex flex-wrap gap-1.5">
              {people.length === 0 && <span className="text-14 text-ink-4">Nadie todavía</span>}
              {people.map((p) => (
                <PlayerChip
                  key={p.id}
                  name={p.name}
                  me={p.id === meId}
                  bench={p.slot === null}
                  onRemove={onRemove ? () => onRemove(p) : undefined}
                  removing={removingId === p.id}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
