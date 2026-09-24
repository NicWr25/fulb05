/**
 * Enlaces para compartir por WhatsApp.
 * https://wa.me/?text=... abre WhatsApp (app o web) con el mensaje escrito y
 * deja elegir el chat. No usa la API de WhatsApp: es un enlace común.
 */
export function whatsappUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export function inviteMessage(opts: { title: string; when: string; venue: string | null; url: string }): string {
  return `⚽ ${opts.title} · ${opts.when}${opts.venue ? ` · ${opts.venue}` : ""}\nAnotate acá: ${opts.url}`;
}

/** El título por defecto sigue el nombre actual del organizador. */
export function matchTitle(title: string | null, organizerName: string): string {
  return title?.trim() || `Partido de ${organizerName}`;
}
