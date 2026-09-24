"use client";

import { SuccessMark } from "@/components/ui/SuccessMark";
import { cx } from "@/lib/cx";

/** Confirmación compacta que queda inmediatamente arriba de la cancha. */
export function MyEntryCard({ name, line, hint, error, busy, editingAlias, onEditAlias, onLeave }: {
  name: string; line: string; hint: string; error?: string | null;
  busy?: boolean; editingAlias?: boolean; onEditAlias: () => void; onLeave: () => void;
}) {
  return <div className="rounded-panel border border-line bg-surface px-3 py-2.5">
    <div className="flex flex-wrap items-center gap-2.5">
      <div className="flex min-w-[130px] flex-1 items-center gap-2.5">
        <SuccessMark />
        <div className="min-w-0">
          <p className="font-semibold text-14">¡Listo, {name}!</p>
          <p className="text-13 text-ink-2">{line}</p>
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        <button type="button" onClick={onEditAlias} disabled={busy || editingAlias}
          className="min-h-11 rounded-btn border border-line-strong px-3 text-13 font-semibold disabled:opacity-50">Editar alias</button>
        <button type="button" onClick={onLeave} disabled={busy}
          className="min-h-11 rounded-btn border border-line-strong px-3 text-13 font-semibold text-danger disabled:opacity-50">Bajarme</button>
      </div>
    </div>
    <p aria-live="polite" className={cx("text-13", error ? "font-semibold text-danger" : "text-ink-2")}>{error ?? hint}</p>
  </div>;
}
