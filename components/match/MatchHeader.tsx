import type { ReactNode } from "react";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { MapsLink } from "@/components/ui/MapsLink";
import { PinIcon } from "@/components/ui/icons";

/** Cabecera del partido: eyebrow, título, día y hora, cancha, organizador y acción a la derecha. */
export function MatchHeader({
  eyebrow,
  title,
  when,
  venue,
  mapsUrl,
  organizer,
  action,
}: {
  eyebrow: string;
  title: string;
  when: string;
  venue: string;
  mapsUrl: string | null;
  organizer?: string;
  action?: ReactNode;
}) {
  return (
    <header className="flex items-start gap-3">
      <div className="flex grow flex-col gap-1 lg:gap-1.5">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className="font-display text-30 leading-[1.05] font-extrabold break-words lg:text-40">{title}</h1>
        <p className="text-14 text-ink-2 lg:text-15">{when}</p>
        {mapsUrl ? (
          <MapsLink href={mapsUrl} className="text-14 lg:text-15">
            {venue} · Cómo llegar
          </MapsLink>
        ) : (
          <p className="inline-flex min-h-8 items-center gap-1.5 text-14 font-semibold text-link-green lg:text-15">
            <PinIcon />
            {venue}
          </p>
        )}
        {organizer && <p className="text-13 text-ink-2 lg:text-14">Organiza {organizer}</p>}
      </div>
      {action}
    </header>
  );
}
