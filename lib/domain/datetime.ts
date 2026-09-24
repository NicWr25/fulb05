/**
 * Fechas del partido. Todo se formatea en la zona horaria DEL PARTIDO
 * (matches.timezone), no en la del dispositivo: "21:00" es la hora de la
 * cancha para todos, y el servidor (que corre en UTC) muestra lo mismo.
 */

const LOCALE = "es-UY";

function parts(iso: string, timeZone: string) {
  const fmt = new Intl.DateTimeFormat(LOCALE, {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const out: Record<string, string> = {};
  for (const p of fmt.formatToParts(new Date(iso))) out[p.type] = p.value;
  return out;
}

const capitalize = (s: string) => s.charAt(0).toLocaleUpperCase(LOCALE) + s.slice(1);

/** "viernes" */
export function weekday(iso: string, timeZone: string): string {
  return parts(iso, timeZone).weekday;
}

/** "Viernes 26/9 · 21:00" */
export function formatMatchDate(iso: string, timeZone: string): string {
  const p = parts(iso, timeZone);
  return `${capitalize(p.weekday)} ${p.day}/${p.month} · ${p.hour}:${p.minute}`;
}

/** "Viernes 21:00" (para el título de Open Graph). */
export function formatWeekdayTime(iso: string, timeZone: string): string {
  const p = parts(iso, timeZone);
  return `${capitalize(p.weekday)} ${p.hour}:${p.minute}`;
}

/** Día y hora locales ("2026-09-26", "21:00") para precargar los inputs del formulario de edición. */
export function toLocalInputs(iso: string, timeZone: string): { date: string; time: string } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const p: Record<string, string> = {};
  for (const x of fmt.formatToParts(new Date(iso))) p[x.type] = x.value;
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

/** Zona IANA del navegador (ej. "America/Montevideo"). */
export function browserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}
