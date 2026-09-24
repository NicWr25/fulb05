"use client";

import { useId, useState, type FormEvent, type ReactNode } from "react";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { MapsLink } from "@/components/ui/MapsLink";
import { EditIcon, PinIcon } from "@/components/ui/icons";
import { errorMessage } from "@/lib/domain/errors";
import { LIMITS } from "@/lib/domain/validation";

/** Cabecera del partido: eyebrow, título, día y hora, cancha, organizador y acción a la derecha. */
export function MatchHeader({
  eyebrow,
  title,
  when,
  venue,
  mapsUrl,
  organizer,
  action,
  onRenameTitle,
}: {
  eyebrow?: string;
  title: string;
  when: string;
  venue: string | null;
  mapsUrl: string | null;
  organizer?: string;
  action?: ReactNode;
  onRenameTitle?: (title: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!onRenameTitle || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onRenameTitle(draft.trim());
      setEditing(false);
    } catch (err) {
      setError(errorMessage(err as Parameters<typeof errorMessage>[0]));
    } finally {
      setBusy(false);
    }
  }

  return (
    <header className="flex items-start gap-3">
      <div className="flex grow flex-col gap-1 lg:gap-1.5">
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <h1 className={editing ? "sr-only" : "font-display text-30 leading-[1.05] font-extrabold break-words lg:text-40"}>
          {editing ? "Editar nombre del partido" : onRenameTitle ? (
            <button type="button" onClick={() => { setDraft(title); setEditing(true); setError(null); }}
              aria-label={`Editar nombre del partido: ${title}`}
              className="inline-flex min-h-11 items-center gap-2 text-left">
              {title}<EditIcon />
            </button>
          ) : title}
        </h1>
        {editing && (
          <form onSubmit={save} className="flex flex-col gap-2">
            <label htmlFor={inputId} className="sr-only">Nombre del partido</label>
            <input id={inputId} autoFocus value={draft} maxLength={LIMITS.title}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Escape") { setEditing(false); setError(null); } }}
              className="min-w-0 rounded-field border border-line-strong bg-field px-2 text-20 text-ink lg:text-30" />
            <span className="flex gap-2 text-14">
              <button type="submit" disabled={busy} className="min-h-11 rounded-btn bg-ink px-3 font-semibold text-white disabled:opacity-50">Guardar</button>
              <button type="button" onClick={() => { setEditing(false); setError(null); }} className="min-h-11 rounded-btn border border-line-strong px-3 text-ink">Cancelar</button>
            </span>
            {error && <span role="alert" className="text-13 font-normal text-danger">{error}</span>}
          </form>
        )}
        <p className="text-14 text-ink-2 lg:text-15">{when}</p>
        {mapsUrl ? (
          <MapsLink href={mapsUrl} className="text-14 lg:text-15">
            {venue ? `${venue} · Cómo llegar` : "Ver ubicación"}
          </MapsLink>
        ) : venue ? (
          <p className="inline-flex min-h-8 items-center gap-1.5 text-14 font-semibold text-link-green lg:text-15">
            <PinIcon />
            {venue}
          </p>
        ) : null}
        {organizer && <p className="text-13 text-ink-2 lg:text-14">Organiza {organizer}</p>}
      </div>
      {action}
    </header>
  );
}
