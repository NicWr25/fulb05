import { forwardRef, type CSSProperties, type HTMLAttributes, type ReactNode } from "react";
import { cx } from "@/lib/cx";
import type { Point } from "@/lib/domain/positions";

/**
 * Líneas reglamentarias en proporción 68×105 (metros). Dos SVG: uno parado
 * (celular) y uno acostado (escritorio); CSS muestra el que corresponde.
 * Son decorativas (aria-hidden): la información está en las fichas.
 */
function LinesVertical() {
  return (
    <svg viewBox="0 0 68 105" className="absolute inset-0 size-full lg:hidden" aria-hidden="true"
      fill="none" stroke="rgb(255 255 255 / 0.8)" strokeWidth={0.35}>
      <rect x="2" y="2" width="64" height="101" />
      <line x1="2" y1="52.5" x2="66" y2="52.5" />
      <circle cx="34" cy="52.5" r="9.15" />
      <circle cx="34" cy="52.5" r="0.5" fill="rgb(255 255 255 / 0.8)" />
      <rect x="13.84" y="2" width="40.32" height="16.5" />
      <rect x="24.84" y="2" width="18.32" height="5.5" />
      <path d="M26.69 18.5 A9.15 9.15 0 0 0 41.31 18.5" />
      <circle cx="34" cy="13" r="0.45" fill="rgb(255 255 255 / 0.8)" />
      <rect x="30.34" y="0.4" width="7.32" height="1.6" />
      <rect x="13.84" y="86.5" width="40.32" height="16.5" />
      <rect x="24.84" y="97.5" width="18.32" height="5.5" />
      <path d="M26.69 86.5 A9.15 9.15 0 0 1 41.31 86.5" />
      <circle cx="34" cy="92" r="0.45" fill="rgb(255 255 255 / 0.8)" />
      <rect x="30.34" y="103" width="7.32" height="1.6" />
    </svg>
  );
}

function LinesHorizontal() {
  return (
    <svg viewBox="0 0 105 68" className="absolute inset-0 hidden size-full lg:block" aria-hidden="true"
      fill="none" stroke="rgb(255 255 255 / 0.8)" strokeWidth={0.35}>
      <rect x="2" y="2" width="101" height="64" />
      <line x1="52.5" y1="2" x2="52.5" y2="66" />
      <circle cx="52.5" cy="34" r="9.15" />
      <circle cx="52.5" cy="34" r="0.5" fill="rgb(255 255 255 / 0.8)" />
      <rect x="2" y="13.84" width="16.5" height="40.32" />
      <rect x="2" y="24.84" width="5.5" height="18.32" />
      <path d="M18.5 26.69 A9.15 9.15 0 0 1 18.5 41.31" />
      <circle cx="13" cy="34" r="0.45" fill="rgb(255 255 255 / 0.8)" />
      <rect x="0.4" y="30.34" width="1.6" height="7.32" />
      <rect x="86.5" y="13.84" width="16.5" height="40.32" />
      <rect x="97.5" y="24.84" width="5.5" height="18.32" />
      <path d="M86.5 26.69 A9.15 9.15 0 0 0 86.5 41.31" />
      <circle cx="92" cy="34" r="0.45" fill="rgb(255 255 255 / 0.8)" />
      <rect x="103" y="30.34" width="1.6" height="7.32" />
    </svg>
  );
}

/** Superficie de la cancha. Los hijos se ubican con <PitchSpot>. */
export const Pitch = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement> & { children?: ReactNode }>(
  function Pitch({ className, children, ...rest }, ref) {
    return (
      <div
        ref={ref}
        className={cx(
          "pitch-surface relative w-full shrink-0 overflow-hidden rounded-box shadow-pitch select-none",
          "aspect-[68/105] lg:aspect-[105/68]",
          className,
        )}
        {...rest}
      >
        <LinesVertical />
        <LinesHorizontal />
        {children}
      </div>
    );
  },
);

/** Posiciona a su hijo en un punto canónico de la cancha (ver .pitch-spot). */
export function PitchSpot({ point, z = 1, children }: { point: Point; z?: number; children: ReactNode }) {
  const style = { "--x": point.x, "--y": point.y, zIndex: z } as CSSProperties;
  return (
    <div className="pitch-spot" style={style}>
      {children}
    </div>
  );
}
