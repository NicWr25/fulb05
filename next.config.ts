import type { NextConfig } from "next";

/**
 * Encabezados de seguridad para todas las rutas.
 * - frame-ancestors / X-Frame-Options: nadie puede meter la app en un
 *   <iframe> (evita "clickjacking": un sitio que superpone el panel del
 *   organizador y te hace tocar "Sacar" sin que lo sepas).
 * - nosniff: el navegador no "adivina" tipos de archivo.
 * - Referrer-Policy: al salir a Google Maps o WhatsApp solo viaja el dominio,
 *   no la URL completa. (El token de admin va en el #, que nunca viaja igual.)
 * - Permissions-Policy: la app no usa cámara, micrófono ni ubicación.
 *
 * No se agrega una Content-Security-Policy completa de scripts: Next.js
 * inyecta scripts inline y exigiría nonces por request (render dinámico en
 * todas las páginas). Queda como mejora futura.
 */
const securityHeaders = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
