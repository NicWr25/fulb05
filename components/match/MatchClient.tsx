"use client";

import { useEffect, useState } from "react";
import type { Match } from "@/lib/domain/match";
import { useMatch } from "@/lib/hooks/useMatch";
import { ConnectionBanner } from "./ConnectionBanner";
import { NotFoundCard } from "./NotFoundCard";
import { OrganizerView } from "./OrganizerView";
import { PlayerView } from "./PlayerView";

/**
 * Punto de entrada del partido en el cliente: sesión + datos en vivo
 * (useMatch) y elección de vista.
 *   - Si tu uid está en match_admins → panel del organizador.
 *   - Si no → vista de jugador.
 * Ojo: esto es solo PRESENTACIÓN. Que el panel se vea no da ningún poder:
 * cada acción de admin la valida la base (RLS / is_match_admin).
 */
export function MatchClient({
  initial,
  renderedAt,
  shareHref,
}: {
  initial: Match;
  /** Hora de Postgres al renderizar (server_now): el mismo reloj que usa el trigger de cierre. */
  renderedAt: number;
  shareHref: string;
}) {
  const state = useMatch(initial);
  const { match, status, live, isAdmin } = state;
  const startsAt = Date.parse(match.starts_at);

  // "Ahora" según el reloj de Postgres (el que usa el trigger de cierre).
  // Arranca en la hora del render del servidor y se actualiza con un
  // temporizador justo cuando empieza el partido: así, si tenés la página
  // abierta, se cierra sola en vez de mostrar botones que la base rechazaría.
  const [now, setNow] = useState(renderedAt);
  useEffect(() => {
    // Diferencia entre el reloj del celular y el de Postgres (pueden no coincidir).
    const offset = renderedAt - Date.now();
    const serverNow = () => Date.now() + offset;
    const wait = startsAt - serverNow();
    // setTimeout no admite esperas de más de ~24 días; más allá, ni vale la pena.
    if (wait <= 0 || wait > 2 ** 31 - 1) return;
    const t = setTimeout(() => setNow(serverNow()), wait + 500);
    return () => clearTimeout(t);
  }, [startsAt, renderedAt]);

  if (status === "gone") {
    return <NotFoundCard title="Este partido ya no existe" body="Lo borraron mientras lo mirabas." />;
  }

  // Si el admin reprograma a una fecha futura, startsAt > now y se reabre.
  const closed = startsAt <= now;

  return (
    <>
      <ConnectionBanner live={status === "ready" ? live : "connecting"} />
      {isAdmin ? (
        <OrganizerView state={state} closed={closed} shareHref={shareHref} />
      ) : (
        <PlayerView state={state} closed={closed} shareHref={shareHref} />
      )}
    </>
  );
}
