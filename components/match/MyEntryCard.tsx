"use client";

import { SuccessMark } from "@/components/ui/SuccessMark";
import { cx } from "@/lib/cx";

/** Confirmación compacta que queda inmediatamente arriba de la cancha. */
export function MyEntryCard({ name, line, moveHint, error, canMove, busy, onMove, onLeave }: {
  name: string; line: string; moveHint: string; error?: string | null;
  canMove: boolean; busy?: boolean; onMove: () => void; onLeave: () => void;
}) {
  return <div className="rounded-panel border border-line bg-surface px-3 py-2.5">
    <div className="flex items-center gap-2.5">
      <SuccessMark />
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-14">¡Listo, {name}!</p>
        <p className="text-13 text-ink-2">{line}</p>
      </div>
      <button type="button" onClick={onLeave} disabled={busy}
        className="min-h-11 rounded-btn border border-line-strong px-3 text-13 font-semibold text-danger disabled:opacity-50">Bajarme</button>
    </div>
    <div className="flex items-center gap-2">
      <p aria-live="polite" className={cx("min-w-0 flex-1 text-13", error ? "font-semibold text-danger" : "text-ink-2")}>{error ?? moveHint}</p>
      {canMove && <button type="button" onClick={onMove} disabled={busy}
        className="min-h-11 rounded-btn bg-ink px-3 text-13 font-semibold text-white disabled:opacity-50">Cambiarme</button>}
    </div>
  </div>;
}
