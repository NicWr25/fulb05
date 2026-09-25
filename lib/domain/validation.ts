/**
 * Validaciones del formulario. Son un ESPEJO de los CHECK de la base
 * (supabase/migrations/..._schema.sql): sirven para dar feedback inmediato,
 * pero la validación que manda es la de Postgres.
 */

export const LIMITS = { title: 60, venue: 80, name: 24, alias: 24, mapsUrl: 500 } as const;

// Caracteres de control (saltos de línea, tabs...): el CHECK los rechaza.
const CONTROL = /[\u0000-\u001f\u007f]/;

// Mismo patrón que matches.maps_url.
const MAPS_RE =
  /^https:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps|(www\.)?google\.[a-z.]+\/maps|maps\.google\.[a-z.]+)([/?#]|$)/i;

/**
 * Normaliza lo que la gente pega desde Google Maps: le agrega "https://" si
 * falta y pasa http a https (la base solo acepta https).
 */
export function normalizeMapsUrl(raw: string): string {
  const url = raw.trim();
  if (!url) return "";
  if (/^http:\/\//i.test(url)) return "https://" + url.slice(7);
  if (!/^https:\/\//i.test(url)) return "https://" + url;
  return url;
}

export function isValidMapsUrl(url: string): boolean {
  return url.length <= LIMITS.mapsUrl && MAPS_RE.test(url);
}

/** Error de un nombre de jugador (null si está bien). */
export function playerNameError(raw: string): string | null {
  const name = raw.trim();
  if (!name) return "Poné tu nombre.";
  if (name.length > LIMITS.name) return `Hasta ${LIMITS.name} letras.`;
  if (CONTROL.test(name)) return "El nombre tiene caracteres raros.";
  return null;
}

/** El alias puede quedar vacío: en ese caso se muestra el nombre real. */
export function playerAliasError(raw: string): string | null {
  const alias = raw.trim();
  if (alias.length > LIMITS.alias) return `Hasta ${LIMITS.alias} letras.`;
  if (CONTROL.test(alias)) return "El alias tiene caracteres raros.";
  return null;
}

export type CreateMatchInput = {
  format: 5 | 7;
  title: string;
  date: string; // "2026-09-26"
  time: string; // "21:00"
  venue: string;
  mapsUrl: string;
  organizerName: string;
};

export type CreateMatchErrors = Partial<Record<"title" | "date" | "time" | "mapsUrl" | "organizerName", string>>;

/**
 * Valida el formulario de crear/editar partido. `now` se inyecta para poder
 * testear sin depender del reloj.
 */
export function validateMatchInput(input: CreateMatchInput, now: Date = new Date()): CreateMatchErrors {
  const e: CreateMatchErrors = {};
  const title = input.title.trim();

  if (title.length > LIMITS.title) e.title = `Hasta ${LIMITS.title} letras.`;
  else if (CONTROL.test(title)) e.title = "El nombre tiene caracteres raros.";

  if (!input.date) e.date = "Elegí el día.";
  if (!input.time) e.time = "Elegí la hora.";
  if (input.date && input.time) {
    // Se interpreta en la zona del navegador, que es la que se manda a la base.
    const when = new Date(`${input.date}T${input.time}`);
    if (Number.isNaN(when.getTime())) e.date = "Esa fecha no es válida.";
    else if (when <= now) e.date = "Tiene que ser una fecha futura.";
    else if (when.getTime() - now.getTime() > 365 * 24 * 3600 * 1000) e.date = "Como mucho, dentro de un año.";
  }

  const maps = normalizeMapsUrl(input.mapsUrl);
  if (!maps) e.mapsUrl = "Pegá el enlace de Google Maps.";
  else if (!isValidMapsUrl(maps)) e.mapsUrl = "Ese enlace no parece de Google Maps.";

  const nameErr = playerNameError(input.organizerName);
  if (nameErr) e.organizerName = nameErr;

  return e;
}

/**
 * Enlace de Google Maps para un lugar elegido en el buscador. Usa el formato
 * público "Maps URLs" (no necesita key ni cobra): `query_place_id` apunta al
 * lugar exacto y `query` es el texto de respaldo si el id dejara de existir.
 * El resultado cumple el mismo CHECK que un enlace pegado a mano: si el
 * nombre codificado lo haría pasar de 500 caracteres, se acorta el nombre
 * (por caracteres completos, para no cortar un emoji a la mitad).
 */
export function mapsUrlFromPlace(place: { placeId: string; name: string }): string {
  let chars = Array.from(place.name.trim()).slice(0, LIMITS.venue);
  for (;;) {
    const params = new URLSearchParams({
      api: "1",
      query: chars.join(""),
      query_place_id: place.placeId,
    });
    const url = `https://www.google.com/maps/search/?${params}`;
    if (url.length <= LIMITS.mapsUrl || chars.length === 0) return url;
    chars = chars.slice(0, -1);
  }
}

/**
 * Nombre de la cancha a partir del lugar elegido. Ya no se escribe a mano:
 * sale de Google (o del enlace pegado), así que se limpia para que siempre
 * cumpla el CHECK de la base (sin caracteres de control, hasta 80).
 * null = sin nombre (la UI muestra "Ver ubicación").
 */
export function venueName(raw: string | null | undefined): string | null {
  const clean = (raw ?? "").replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
  const name = Array.from(clean).slice(0, LIMITS.venue).join("").trim();
  return name || null;
}

/** Solo los enlaces largos /maps/place/ incluyen un nombre legible localmente. */
export function venueFromMapsUrl(raw: string): string | null {
  try {
    const url = new URL(normalizeMapsUrl(raw));
    const match = url.pathname.match(/\/maps\/place\/([^/]+)/i);
    if (!match) return null;
    return venueName(decodeURIComponent(match[1].replace(/\+/g, " ")));
  } catch {
    return null;
  }
}
