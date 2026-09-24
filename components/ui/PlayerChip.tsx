"use client";

import { useState } from "react";
import { cx } from "@/lib/cx";
import { XIcon } from "./icons";

/** Chip de muestra para la galería de componentes. */
export function PlayerChip({
  name,
  me,
  onRemove,
  removing,
}: {
  name: string;
  me?: boolean;
  onRemove?: () => void;
  removing?: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const label = name + (me ? " (vos)" : "");

  const base = cx(
    "inline-flex min-h-8 items-center rounded-full border text-14",
    me ? "border-me-border bg-me-bg font-semibold" : "border-line bg-surface",
  );

  if (!onRemove) {
    return <span className={cx(base, "px-3")}>{label}</span>;
  }

  if (confirming) {
    return (
      <span className={cx(base, "gap-1 border-danger pl-3")} role="group" aria-label={`Confirmar sacar a ${name}`}>
        <span>¿Sacar a {name}?</span>
        <button
          type="button"
          disabled={removing}
          onClick={() => onRemove()}
          className="h-11 px-2 font-semibold text-danger"
        >
          Sí
        </button>
        <button type="button" onClick={() => setConfirming(false)} className="h-11 pr-3 pl-1 font-semibold text-ink-2">
          No
        </button>
      </span>
    );
  }

  return (
    <span className={cx(base, "gap-0.5 pl-3")}>
      {label}
      {/* 44×44 de área táctil (el diseño usa 40 en celular y 32 en escritorio). */}
      <button
        type="button"
        aria-label={`Sacar a ${name}`}
        onClick={() => setConfirming(true)}
        className="-my-1.5 flex size-11 items-center justify-center rounded-full text-ink-2"
      >
        <XIcon />
      </button>
    </span>
  );
}
