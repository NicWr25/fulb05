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
import { PinIcon, WhatsAppIcon } from "@/components/ui/icons";
import { ensureSession, supabaseBrowser } from "@/lib/supabase/browser";
import { browserTimeZone } from "@/lib/domain/datetime";
import { errorMessage } from "@/lib/domain/errors";
import { adminSelfMessage, inviteMessage, whatsappUrl } from "@/lib/domain/share";
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

type Created = { id: string; adminToken: string; input: CreateMatchInput };

/** "viernes 26/9" a partir de "2026-09-26" (fecha local, sin zona horaria). */
function niceDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const day = new Date(y, m - 1, d).toLocaleDateString("es-UY", { weekday: "long" });
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
  const set = <K extends keyof CreateMatchInput>(k: K) => (v: CreateMatchInput[K]) => setInput((s) => ({ ...s, [k]: v }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setTried(true);
    setServerError(null);
    if (Object.keys(errors).length > 0) {
      // Llevar el foco al primer campo con error (útil con lector de pantalla y en el celu).
      requestAnimationFrame(() => document.querySelector<HTMLInputElement>("[aria-invalid=true]")?.focus());
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
      const res = data as { id: string; admin_token: string };
      setCreated({ id: res.id, adminToken: res.admin_token, input });
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
        <h2 className="font-display text-24 font-extrabold lg:text-26">Nuevo partido</h2>

        <SegmentedControl
          label="Formato"
          value={input.format}
          onChange={set("format")}
          options={[
            { value: 5, label: "5 vs 5" },
            { value: 7, label: "7 vs 7" },
          ]}
        />

        <TextField
          label="Nombre del partido"
          labelNote="(opcional)"
          autoComplete="off"
          placeholder="ej. Fútbol del viernes"
          maxLength={LIMITS.title}
          value={input.title}
          onChange={(e) => set("title")(e.target.value)}
          error={show("title")}
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

        <TextField
          label="Cancha"
          autoComplete="off"
          placeholder="Nombre de la cancha"
          maxLength={LIMITS.venue}
          value={input.venue}
          onChange={(e) => set("venue")(e.target.value)}
          error={show("venue")}
        />

        <TextField
          label="Ubicación en Google Maps"
          labelNote="(opcional)"
          type="url"
          inputMode="url"
          autoComplete="off"
          placeholder="Pegá el enlace de la cancha"
          icon={<PinIcon />}
          value={input.mapsUrl}
          onChange={(e) => set("mapsUrl")(e.target.value)}
          error={show("mapsUrl")}
          hint="En Google Maps buscá la cancha, tocá Compartir y copiá el enlace. Así los jugadores ven cómo llegar."
        />

        <div className="h-px bg-sand" />

        <TextField
          label="Tu nombre"
          autoComplete="name"
          placeholder="ej. Nico"
          maxLength={LIMITS.name}
          value={input.organizerName}
          onChange={(e) => set("organizerName")(e.target.value)}
          error={show("organizerName")}
          hint="Aparece como “Organiza …” en el partido. No hace falta crear cuenta."
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

function Created({ created, onReset }: { created: Created; onReset: () => void }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  // Este componente solo se muestra después de enviar el formulario (nunca en
  // el render del servidor), así que `window` siempre existe acá.
  const origin = window.location.origin;

  useEffect(() => {
    // Mover el foco al título para que el lector de pantalla anuncie el éxito.
    headingRef.current?.focus();
  }, []);

  const { id, adminToken, input } = created;
  const title = input.title.trim() || `Partido del ${niceDate(input.date).split(" ")[0]}`;
  const when = `${niceDate(input.date)}, ${input.time}`;
  const publicUrl = `${origin}/p/${id}`;
  // El token va en el FRAGMENTO (#): el navegador nunca lo manda al servidor,
  // así no queda en logs ni en el header Referer.
  const adminUrl = `${origin}/p/${id}/admin#${adminToken}`;
  const bare = (u: string) => u.replace(/^https?:\/\//, "");
  const maps = normalizeMapsUrl(input.mapsUrl);

  return (
    <Card panel>
      <div className="flex flex-col gap-[18px]">
        <div className="flex items-center gap-3">
          <SuccessMark size={36} />
          <h2 ref={headingRef} tabIndex={-1} className="font-display text-24 font-extrabold outline-none lg:text-26">
            ¡Partido creado!
          </h2>
        </div>

        <p className="text-15 leading-normal text-ink-2">
          {title} · {when} · {input.venue.trim()} · {input.format} vs {input.format}
        </p>
        {maps && <MapsLink href={maps} className="text-15">Ver la cancha en Google Maps</MapsLink>}

        <div className="flex flex-col gap-2">
          <LinkBox
            title="Enlace para invitar"
            url={publicUrl}
            displayUrl={bare(publicUrl)}
            note="Pasalo por el grupo para que se anoten."
          />
          <a
            href={whatsappUrl(inviteMessage({ title, when, venue: input.venue.trim(), url: publicUrl }))}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-12 items-center justify-center gap-2 rounded-btn border border-ink text-16 font-semibold text-ink no-underline hover:text-ink"
          >
            <WhatsAppIcon /> Mandar al grupo por WhatsApp
          </a>
        </div>

        <div className="flex flex-col gap-2">
          <LinkBox
            tone="admin"
            title="Tu enlace de organizador"
            url={adminUrl}
            displayUrl={`${bare(origin)}/p/${id}/admin#••••••`}
            note="Con este enlace editás el partido desde cualquier celular. No lo compartas: guardalo en un chat con vos mismo."
          />
          <a
            href={whatsappUrl(adminSelfMessage({ title, adminUrl }))}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-11 items-center justify-center gap-2 rounded-btn text-15 font-semibold text-admin-ink underline underline-offset-2 hover:text-admin-ink"
          >
            <WhatsAppIcon size={16} /> Mandármelo por WhatsApp
          </a>
        </div>

        <Link
          href={`/p/${id}`}
          className="flex h-13 items-center justify-center rounded-btn bg-ink text-16 font-semibold text-white no-underline hover:text-white lg:text-17"
        >
          Ir al panel del organizador
        </Link>
        <Button variant="ghost" size="sm" onClick={onReset}>
          Crear otro partido
        </Button>
      </div>
    </Card>
  );
}
