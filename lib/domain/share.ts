/**
 * Enlaces para compartir por WhatsApp.
 * https://wa.me/?text=... abre WhatsApp (app o web) con el mensaje escrito y
 * deja elegir el chat. No usa la API de WhatsApp: es un enlace común.
 */
export function whatsappUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export function inviteMessage(opts: { title: string; when: string; venue: string; url: string }): string {
  return `⚽ ${opts.title} · ${opts.when} · ${opts.venue}\nAnotate acá: ${opts.url}`;
}

export function adminSelfMessage(opts: { title: string; adminUrl: string }): string {
  return `🔒 Mi enlace de organizador de "${opts.title}" (no lo compartas):\n${opts.adminUrl}`;
}

/** Título por defecto si el organizador no le puso nombre: "Partido del viernes". */
export function matchTitle(title: string | null, weekdayName: string): string {
  return title?.trim() || `Partido del ${weekdayName}`;
}
