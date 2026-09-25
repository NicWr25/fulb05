"use client";

import { useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { XIcon } from "@/components/ui/icons";
import { MapsField } from "@/components/create/MapsField";
import { toLocalInputs } from "@/lib/domain/datetime";
import { errorMessage } from "@/lib/domain/errors";
import type { Match } from "@/lib/domain/match";
import { LIMITS, normalizeMapsUrl, validateMatchInput, type CreateMatchInput } from "@/lib/domain/validation";

type Fields = Omit<CreateMatchInput, "format" | "title">;

/**
 * "Editar datos del partido" (no está en el diseño; el spec lo pide).
 * Usa <dialog> nativo con showModal(): el navegador se encarga de atrapar el
 * foco, cerrar con Esc y devolver el foco al botón que lo abrió.
 * Reusa los campos del formulario de crear.
 *
 * La hora se interpreta en la zona del PARTIDO (match.timezone), no en la del
 * dispositivo del admin: la conversión la hace update_match en SQL.
 */
export function useEditMatchDialog(
  match: Match,
  save: (fields: Fields) => Promise<unknown>,
) {
  const ref = useRef<HTMLDialogElement>(null);
  const [fields, setFields] = useState<Fields | null>(null);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function open() {
    const { date, time } = toLocalInputs(match.starts_at, match.timezone);
    setFields({
      date,
      time,
      venue: match.venue ?? "",
      mapsUrl: match.maps_url ?? "",
      organizerName: match.organizer_name,
    });
    setTried(false);
    setError(null);
    ref.current?.showModal();
  }

  const original = toLocalInputs(match.starts_at, match.timezone);
  const errors = fields ? validateMatchInput({ ...fields, title: match.title ?? "", format: match.format }) : {};
  // Si no se tocó la fecha, no se exige que sea futura (ej. corregir la
  // cancha de un partido que ya empezó).
  if (fields && fields.date === original.date && fields.time === original.time) delete errors.date;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setTried(true);
    if (!fields || Object.keys(errors).length > 0) return;
    setBusy(true);
    setError(null);
    try {
      await save({ ...fields, mapsUrl: normalizeMapsUrl(fields.mapsUrl) });
      ref.current?.close();
    } catch (err) {
      setError(errorMessage(err as Parameters<typeof errorMessage>[0]));
    } finally {
      setBusy(false);
    }
  }

  const set = (k: keyof Fields) => (v: string) => setFields((f) => (f ? { ...f, [k]: v } : f));
  const show = (k: keyof typeof errors) => (tried ? errors[k] : undefined);

  const dialog = (
    <dialog
      ref={ref}
      aria-labelledby="edit-match-title"
      className="m-auto max-h-[90dvh] w-[calc(100%-32px)] max-w-[480px] overflow-y-auto rounded-panel border border-line bg-surface p-5 text-ink backdrop:bg-ink/50 lg:p-7"
    >
      {fields && (
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <h2 id="edit-match-title" className="font-display text-24 font-extrabold">
              Editar partido
            </h2>
            <button
              type="button"
              aria-label="Cerrar"
              onClick={() => ref.current?.close()}
              className="flex size-11 items-center justify-center rounded-full text-ink-2"
            >
              <XIcon size={18} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Día" type="date" value={fields.date} onChange={(e) => set("date")(e.target.value)} error={show("date")} />
            <TextField label="Hora" type="time" value={fields.time} onChange={(e) => set("time")(e.target.value)} error={show("time")} />
          </div>
          <MapsField
            value={fields.mapsUrl}
            venue={fields.venue}
            onChange={(mapsUrl, venue) => setFields((old) => (old ? { ...old, mapsUrl, venue: venue ?? "" } : old))}
            error={show("mapsUrl")}
          />
          <TextField
            label="Organiza"
            maxLength={LIMITS.name}
            value={fields.organizerName}
            onChange={(e) => set("organizerName")(e.target.value)}
            error={show("organizerName")}
          />
          <p className="text-13 leading-[1.45] text-ink-2">La hora es la de la cancha ({match.timezone}).</p>
          {error && (
            <p role="alert" className="text-14 font-semibold text-danger">
              {error}
            </p>
          )}
          <Button type="submit" disabled={busy}>
            {busy ? "Guardando…" : "Guardar cambios"}
          </Button>
        </form>
      )}
    </dialog>
  );

  return { open, dialog };
}
