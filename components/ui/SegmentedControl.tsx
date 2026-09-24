"use client";

import { cx } from "@/lib/cx";

type Option<T extends string | number> = { value: T; label: string };

/**
 * Selector de 2+ opciones (ej. "5 vs 5 / 7 vs 7").
 * Se implementa como grupo de botones con aria-pressed, igual que el diseño:
 * cada opción es un botón de 44px de alto, cómodo para el dedo.
 */
export function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  label,
  disabled,
}: {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Nombre accesible del grupo (no se muestra). */
  label: string;
  disabled?: boolean;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="grid gap-1 rounded-btn bg-sand p-1"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            aria-pressed={active}
            disabled={disabled}
            onClick={() => onChange(o.value)}
            className={cx(
              "h-11 rounded-seg text-16 font-semibold text-ink",
              active ? "bg-surface shadow-seg" : "bg-transparent",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
