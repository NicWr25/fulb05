import type { ButtonHTMLAttributes } from "react";
import { cx } from "@/lib/cx";
import { TEAM_TOKEN_CLASS, type Team } from "@/lib/domain/teams";

export type PlayerTokenProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "name"> & {
  team: Team;
  /** Iniciales dentro de la ficha. */
  text: string;
  /** Nombre para la etiqueta de abajo. */
  playerName: string;
  tagAboveMobile?: boolean;
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
 * Solo representa jugadores anotados; la ocupación y los lugares libres se
 * muestran con remeras fuera de la cancha.
 */
export function PlayerToken({
  team,
  text,
  playerName,
  tagAboveMobile,
  mine,
  selected,
  dragging,
  draggable,
  static: isStatic,
  className,
  type = "button",
  ...rest
}: PlayerTokenProps) {
  const circle = cx(
    "flex size-11 items-center justify-center rounded-full font-semibold tracking-[0.02em] lg:size-12",
    TEAM_TOKEN_CLASS[team], "text-15 lg:text-16",
    mine ? "border-[3px] border-gold" : "border-2 border-white",
    dragging ? "shadow-token-drag" : selected ? "shadow-token-sel" : "shadow-token",
    draggable && (dragging ? "cursor-grabbing touch-none" : "cursor-grab touch-none"),
  );

  const tag = (
    <span
      aria-hidden="true"
      className={cx(
        "pointer-events-none absolute left-1/2 max-w-22 -translate-x-1/2 truncate rounded-[5px] px-1.5 py-px text-12 font-semibold whitespace-nowrap",
        tagAboveMobile ? "bottom-full mb-[3px] lg:bottom-auto lg:mb-0" : "top-full mt-[3px]",
        "lg:top-full lg:mt-1.5 lg:max-w-26 lg:rounded-tag lg:px-2 lg:py-0.5 lg:text-13",
        mine ? "bg-gold text-ink" : "bg-tag text-white",
      )}
    >
      {mine ? `Vos · ${playerName}` : playerName}
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
