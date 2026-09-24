"use client";

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

  if (status === "gone") {
    return <NotFoundCard title="Este partido ya no existe" body="Lo borraron mientras lo mirabas." />;
  }

  const closed = new Date(match.starts_at).getTime() <= renderedAt;

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
