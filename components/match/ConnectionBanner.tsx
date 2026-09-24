"use client";

import type { LiveStatus } from "@/lib/hooks/useMatch";

/**
 * Estado no cubierto por el diseño: se cortó el canal en vivo.
 * Franja arena arriba de todo (sticky), con aria-live para que el lector de
 * pantalla avise. Al reconectar, useMatch relee el partido y la franja se va.
 */
export function ConnectionBanner({ live }: { live: LiveStatus }) {
  return (
    <div aria-live="polite" className="sticky top-0 z-50">
      {live === "offline" && (
        <p className="border-b border-line bg-sand px-4 py-2.5 text-center text-14 font-semibold text-ink">
          Sin conexión en vivo. Reintentando… <span className="font-normal text-ink-2">(lo que ves puede estar desactualizado)</span>
        </p>
      )}
    </div>
  );
}
