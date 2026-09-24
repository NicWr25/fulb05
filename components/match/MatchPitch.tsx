import { Pitch, PitchSpot } from "@/components/pitch/Pitch";
import { PlayerToken } from "@/components/pitch/PlayerToken";
import { slotsByTeam, type Match } from "@/lib/domain/match";
import { initials, resolveLayout, ROLE_NAME, slotRoles } from "@/lib/domain/positions";
import { TEAMS, TEAM_LABEL, type Team } from "@/lib/domain/teams";

export type SlotRef = { team: Team; slot: number };

/**
 * La cancha con las fichas de un partido.
 * - Lugares ocupados: ficha estática con iniciales y etiqueta con el nombre.
 * - Lugares libres: botón (si hay onPick) o ficha estática con el rol.
 */
export function MatchPitch({
  match,
  meId,
  selected,
  onPick,
  disabled,
}: {
  match: Pick<Match, "format" | "players" | "layout">;
  meId?: string | null;
  selected?: SlotRef | null;
  onPick?: (ref: SlotRef) => void;
  disabled?: boolean;
}) {
  const layout = resolveLayout(match.format, match.layout);
  const roles = slotRoles(match.format);
  const slots = slotsByTeam(match);

  return (
    <Pitch>
      {TEAMS.flatMap((team) =>
        layout[team].map((point, slot) => {
          const player = slots[team][slot];
          const mine = Boolean(player && meId && player.id === meId);
          const isSelected = selected?.team === team && selected.slot === slot;
          const role = ROLE_NAME[roles[slot]];
          const label = player
            ? `${mine ? "Vos" : player.name}, ${role} de ${TEAM_LABEL[team]}`
            : `Puesto libre de ${role} en ${TEAM_LABEL[team]}`;
          return (
            <PitchSpot key={team + slot} point={point} z={isSelected || mine ? 10 : 1}>
              <PlayerToken
                team={team}
                playerName={player?.name}
                text={player ? initials(player.name) : roles[slot]}
                mine={mine}
                selected={isSelected}
                aria-label={label}
                static={Boolean(player) || !onPick}
                disabled={disabled}
                onClick={onPick ? () => onPick({ team, slot }) : undefined}
              />
            </PitchSpot>
          );
        }),
      )}
    </Pitch>
  );
}
