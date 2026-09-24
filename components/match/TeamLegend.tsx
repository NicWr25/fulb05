import { TeamSwatch } from "@/components/ui/TeamSwatch";
import { TEAM_LABEL } from "@/lib/domain/teams";

/**
 * Reemplaza la barra de formaciones del diseño (no hay selector de formación
 * en el MVP). Dice de qué lado juega cada equipo: en el celular la cancha
 * está parada (Oscuros arriba), en escritorio acostada (Claros a la izquierda).
 */
export function TeamLegend() {
  return (
    <>
      <ul className="flex flex-col gap-2.5 lg:hidden">
        {(["B", "A"] as const).map((t) => (
          <li key={t} className="flex items-center gap-2">
            <TeamSwatch team={t} size={12} />
            <span className="text-14 font-semibold">{TEAM_LABEL[t]}</span>
            <span className="ml-auto text-13 text-ink-2">{t === "B" ? "Arriba" : "Abajo"}</span>
          </li>
        ))}
      </ul>
      <ul className="hidden h-13 items-center justify-between lg:flex">
        {(["A", "B"] as const).map((t) => (
          <li key={t} className="flex items-center gap-2.5">
            <TeamSwatch team={t} />
            <span className="text-16 font-semibold">{TEAM_LABEL[t]}</span>
            <span className="text-14 text-ink-2">{t === "A" ? "← Izquierda" : "Derecha →"}</span>
          </li>
        ))}
      </ul>
    </>
  );
}
