"use client";

import { LIMITS } from "@/lib/domain/validation";

/** Edición compacta de la etiqueta visible de una ficha. */
export function AliasEditor({ value, onChange, onSave, onCancel, busy, error }: {
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
  busy: boolean;
  error?: string | null;
}) {
  return <form onSubmit={(event) => { event.preventDefault(); onSave(); }}
    className="flex flex-col gap-1.5 rounded-panel border border-line bg-surface p-2.5">
    <label htmlFor="player-alias" className="text-13 font-semibold">Alias en la cancha</label>
    <div className="flex flex-wrap gap-2">
      <input id="player-alias" value={value} maxLength={LIMITS.alias}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Vacío para mostrar el nombre"
        aria-invalid={Boolean(error)}
        className="h-11 min-w-0 flex-1 rounded-field border border-line-strong bg-field px-3 text-16" />
      <button type="submit" disabled={busy}
        className="min-h-11 rounded-btn bg-ink px-3 text-13 font-semibold text-white disabled:opacity-50">Guardar</button>
      <button type="button" onClick={onCancel} disabled={busy}
        className="min-h-11 rounded-btn border border-line-strong px-3 text-13 font-semibold">Cancelar</button>
    </div>
    <p className="text-13 text-ink-2">Si lo dejás vacío, se ve el nombre original.</p>
    {error && <p role="alert" className="text-13 font-semibold text-danger">{error}</p>}
  </form>;
}
