/**
 * URL pública del sitio (absoluta), para enlaces de WhatsApp y Open Graph.
 * Orden de preferencia:
 *   1. NEXT_PUBLIC_SITE_URL (la definís vos: dominio propio o *.vercel.app)
 *   2. VERCEL_PROJECT_PRODUCTION_URL (la define Vercel sola en cada deploy)
 *   3. localhost en desarrollo
 */
export function siteUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}
