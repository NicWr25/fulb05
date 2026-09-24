import { formatMatchDate, formatWeekdayTime, weekday } from "./datetime";
import { missingCount, missingLabel, type Match } from "./match";
import { matchTitle } from "./share";

/**
 * Textos de la vista previa (Open Graph) que muestra WhatsApp al pegar el link.
 * Todo en la zona horaria del partido: el servidor corre en UTC.
 */

/** "Fútbol 5 · Jueves 21:00 · Cancha X" */
export function ogTitle(match: Pick<Match, "format" | "starts_at" | "timezone" | "venue">): string {
  return `Fútbol ${match.format} · ${formatWeekdayTime(match.starts_at, match.timezone)} · ${match.venue}`;
}

/** "Fútbol del viernes · Faltan 3 jugadores · Organiza Nico. ¡Anotate!" */
export function ogDescription(match: Match, opts: { closed?: boolean } = {}): string {
  const parts: string[] = [];
  if (match.title) parts.push(match.title);
  if (opts.closed) parts.push("Inscripciones cerradas");
  else parts.push(missingLabel(missingCount(match)));
  parts.push(`Organiza ${match.organizer_name}`);
  return parts.join(" · ") + (opts.closed ? "." : ". ¡Anotate!");
}

/** Datos ya formateados para dibujar la imagen. */
export function ogImageData(match: Match) {
  const perTeam = (t: "A" | "B") => match.players.filter((p) => p.team === t && p.slot !== null).length;
  return {
    title: matchTitle(match.title, weekday(match.starts_at, match.timezone)),
    when: formatMatchDate(match.starts_at, match.timezone),
    venue: match.venue,
    format: match.format,
    missing: missingCount(match),
    missingText: missingLabel(missingCount(match)),
    claros: perTeam("A"),
    oscuros: perTeam("B"),
  };
}
