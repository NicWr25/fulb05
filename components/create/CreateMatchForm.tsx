"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { LinkBox } from "@/components/ui/LinkBox";
import { MapsLink } from "@/components/ui/MapsLink";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { SuccessMark } from "@/components/ui/SuccessMark";
import { TextField } from "@/components/ui/TextField";
import { WhatsAppIcon } from "@/components/ui/icons";
import { MapsField } from "@/components/create/MapsField";
import { ensureSession, supabaseBrowser } from "@/lib/supabase/browser";
import { browserTimeZone } from "@/lib/domain/datetime";
import { errorMessage } from "@/lib/domain/errors";
import { entryDestination } from "@/lib/domain/entry";
import {
  inviteMessage,
  whatsappUrl,
} from "@/lib/domain/share";
import {
  LIMITS,
  normalizeMapsUrl,
  validateMatchInput,
  type CreateMatchInput,
} from "@/lib/domain/validation";

const EMPTY: CreateMatchInput = {
  format: 5,
  title: "",
  date: "",
  time: "",
  venue: "",
  mapsUrl: "",
  organizerName: "",
};

type Created = { id: string; input: CreateMatchInput };

/** "viernes 26/9" a partir de "2026-09-26" (fecha local, sin zona horaria). */
function niceDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const day = new Date(y, m - 1, d).toLocaleDateString("es-UY", {
    weekday: "long",
  });
  return `${day} ${d}/${m}`;
}

export function CreateMatchForm() {
  const [input, setInput] = useState<CreateMatchInput>(EMPTY);
  const [tried, setTried] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [created, setCreated] = useState<Created | null>(null);

  const errors = validateMatchInput(input);
  const show = (k: keyof typeof errors) => (tried ? errors[k] : undefined);
  const set =
    <K extends keyof CreateMatchInput>(k: K) =>
    (v: CreateMatchInput[K]) =>
      setInput((s) => ({ ...s, [k]: v }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setTried(true);
    setServerError(null);
    if (Object.keys(errors).length > 0) {
      // Llevar el foco al primer campo con error (útil con lector de pantalla y en el celu).
      requestAnimationFrame(() =>
        document
          .querySelector<HTMLInputElement>("[aria-invalid=true]")
          ?.focus(),
      );
      return;
    }

    setSubmitting(true);
    try {
      await ensureSession();
      const { data, error } = await supabaseBrowser().rpc("create_match", {
        p_format: input.format,
        p_title: input.title, // "" -> null en la base (clean_text)
        p_venue: input.venue,
        p_maps_url: normalizeMapsUrl(input.mapsUrl),
        p_date: input.date,
        p_time: input.time,
        p_timezone: browserTimeZone(),
        p_organizer_name: input.organizerName,
      });
      if (error) throw error;
      const res = data as { id: string };
      setCreated({ id: res.id, input });
    } catch (err) {
      setServerError(errorMessage(err as Parameters<typeof errorMessage>[0]));
    } finally {
      setSubmitting(false);
    }
  }

  if (created) {
    return (
      <Created
        created={created}
        onReset={() => {
          setCreated(null);
          setInput(EMPTY);
          setTried(false);
        }}
      />
    );
  }

  return (
    <Card panel>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <h2 className="font-display text-24 font-extrabold lg:text-26">
          Nuevo partido
        </h2>

        <SegmentedControl
          label="Formato"
          value={input.format}
          onChange={set("format")}
          options={[
            { value: 5, label: "5 vs 5" },
            { value: 7, label: "7 vs 7" },
          ]}
        />

        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Día"
            type="date"
            value={input.date}
            onChange={(e) => set("date")(e.target.value)}
            error={show("date")}
          />
          <TextField
            label="Hora"
            type="time"
            value={input.time}
            onChange={(e) => set("time")(e.target.value)}
            error={show("time")}
          />
        </div>

        <MapsField
          value={input.mapsUrl}
          onChange={(mapsUrl, venue) => setInput((old) => ({ ...old, mapsUrl, venue: venue ?? "" }))}
          error={show("mapsUrl")}
        />

        <div className="h-px bg-sand" />

        <TextField
          label="Tu nombre"
          autoComplete="name"
          placeholder="Tu nombre"
          maxLength={LIMITS.name}
          value={input.organizerName}
          onChange={(e) => set("organizerName")(e.target.value)}
          error={show("organizerName")}
        />

        {serverError && (
          <p role="alert" className="text-14 text-danger">
            {serverError}
          </p>
        )}

        <Button type="submit" disabled={submitting} className="mt-1">
          {submitting ? "Creando…" : "Crear partido"}
        </Button>
      </form>
    </Card>
  );
}

function Created({
  created,
  onReset,
}: {
  created: Created;
  onReset: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  // Este componente solo se muestra después de enviar el formulario (nunca en
  // el render del servidor), así que `window` siempre existe acá.
  const origin = window.location.origin;

  useEffect(() => {
    // Mover el foco al título para que el lector de pantalla anuncie el éxito.
    headingRef.current?.focus();
  }, []);

  const { id, input } = created;
  const [team, setTeam] = useState<"A" | "B">("A");
  const [joined, setJoined] = useState(false);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  async function join() {
    setJoining(true); setJoinError(null);
    try {
      await ensureSession();
      const point = entryDestination({ format: input.format, layout: null, players: [] }, team);
      const { error } = await supabaseBrowser().rpc("join_match", {
        p_match_id: id,
        p_name: input.organizerName.trim(),
        p_alias: "",
        p_team: team,
        p_x: point.x,
        p_y: point.y,
        p_guest: false,
      });
      if (error) throw error;
      setJoined(true);
    } catch (err) { setJoinError(errorMessage(err as Parameters<typeof errorMessage>[0])); }
    finally { setJoining(false); }
  }
  const title = `Partido de ${input.organizerName.trim()}`;
  const when = `${niceDate(input.date)}, ${input.time}`;
  const publicUrl = `${origin}/p/${id}`;
  const bare = (u: string) => u.replace(/^https?:\/\//, "");
  const maps = normalizeMapsUrl(input.mapsUrl);

  return (
    <Card panel>
      <div className="flex flex-col gap-[18px]">
        <div className="flex items-center gap-3">
          <SuccessMark size={36} />
          <h2
            ref={headingRef}
            tabIndex={-1}
            className="font-display text-24 font-extrabold outline-none lg:text-26"
          >
            ¡Partido creado!
          </h2>
        </div>

        <p className="text-15 leading-normal text-ink-2">
          {title} · {when}{input.venue.trim() ? ` · ${input.venue.trim()}` : ""} · {input.format} vs{" "}
          {input.format}
        </p>
        {maps && (
          <MapsLink href={maps} className="text-15">
            Ver la cancha en Google Maps
          </MapsLink>
        )}

        {!joined && <div className="flex flex-col gap-3 rounded-panel border border-line bg-cream p-4">
          <h3 className="font-display text-20 font-semibold">Primero, elegí tu equipo</h3>
          <p className="text-14 text-ink-2">Vas a jugar como {input.organizerName.trim()}.</p>
          <div className="flex gap-2">{(["A", "B"] as const).map((value) => <button key={value} type="button" aria-pressed={team === value} onClick={() => setTeam(value)} className={`min-h-11 flex-1 rounded-btn border px-3 font-semibold ${team === value ? "border-ink bg-ink text-white" : "border-line-strong bg-surface text-ink"}`}>{value === "A" ? "Blanco" : "Negro"}</button>)}</div>
          {joinError && <p role="alert" className="text-13 text-danger">{joinError}</p>}
          <Button onClick={join} disabled={joining}>{joining ? "Anotando…" : "Anotarme y continuar"}</Button>
        </div>}
        {joined && <div className="flex flex-col gap-2">
          <LinkBox
            title="Enlace para invitar"
            url={publicUrl}
            displayUrl={bare(publicUrl)}
            note="Pasalo por el grupo para que se anoten."
          />
          <a
            href={whatsappUrl(
              inviteMessage({
                title,
                when,
                venue: input.venue.trim(),
                url: publicUrl,
              }),
            )}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-12 items-center justify-center gap-2 rounded-btn border border-ink text-16 font-semibold text-ink no-underline hover:text-ink"
          >
            <WhatsAppIcon /> Mandar al grupo por WhatsApp
          </a>
        </div>}

        {joined && <Link href={`/p/${id}`} className="flex h-13 items-center justify-center rounded-btn bg-ink text-16 font-semibold text-white no-underline hover:text-white lg:text-17">Ir al panel del organizador</Link>}
        <Button variant="ghost" size="sm" onClick={onReset}>
          Crear otro partido
        </Button>
      </div>
    </Card>
  );
}
