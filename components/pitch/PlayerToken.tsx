import type { ButtonHTMLAttributes } from "react";
import { cx } from "@/lib/cx";
import { TEAM_TOKEN_CLASS, type Team } from "@/lib/domain/teams";

export type PlayerTokenProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "name"> & {
  team: Team;
  /** Texto dentro de la ficha: iniciales (ocupado) o número (libre). */
  text: string;
  /** Nombre para la etiqueta de abajo; si no hay, es un lugar libre. */
  playerName?: string | null;
  "aria-label": string;
  mine?: boolean;
  selected?: boolean;
  dragging?: boolean;
  draggable?: boolean;
  /** Ficha no interactiva (ej. lugar ocupado en la vista de jugador). */
  static?: boolean;
};

/**
 * Ficha de la cancha: 44px en celular (mínimo táctil) y 48px en escritorio.
 *
 * Diferencia de accesibilidad con el diseño: el lugar LIBRE usaba un velo
 * blanco al 14% (texto blanco a ~3,8:1, y ~3,3:1 seleccionado). Se reemplaza
 * por un velo negro al 18% (~6,7:1); el anillo dorado sigue marcando la selección.
 */
export function PlayerToken({
  team,
  text,
  playerName,
  mine,
  selected,
  dragging,
  draggable,
  static: isStatic,
  className,
  type = "button",
  ...rest
}: PlayerTokenProps) {
  const filled = Boolean(playerName);

  const circle = cx(
    "flex size-11 items-center justify-center rounded-full font-semibold tracking-[0.02em] lg:size-12",
    filled
      ? cx(TEAM_TOKEN_CLASS[team], "text-15 lg:text-16", mine ? "border-[3px] border-gold" : "border-2 border-white")
      : "border-2 border-dashed border-white/85 bg-black/18 text-11 text-white lg:text-12",
    dragging ? "shadow-token-drag" : selected ? "shadow-token-sel" : "shadow-token",
    draggable && (dragging ? "cursor-grabbing touch-none" : "cursor-grab touch-none"),
  );

  const tag = filled && (
    <span
      aria-hidden="true"
      className={cx(
        "pointer-events-none absolute top-full left-1/2 mt-[3px] max-w-22 -translate-x-1/2 truncate rounded-[5px] px-1.5 py-px text-12 font-semibold whitespace-nowrap",
        "lg:mt-1.5 lg:max-w-26 lg:rounded-tag lg:px-2 lg:py-0.5 lg:text-13",
        mine ? "bg-gold text-ink" : "bg-tag text-white",
      )}
    >
      {mine ? "Vos" : playerName}
    </span>
  );

  return (
    <div className={cx("relative", className)}>
      {isStatic ? (
        <div role="img" aria-label={rest["aria-label"]} className={circle}>
          {text}
        </div>
      ) : (
        <button type={type} aria-pressed={selected} className={cx(circle, "p-0")} {...rest}>
          {text}
        </button>
      )}
      {tag}
    </div>
  );
}
