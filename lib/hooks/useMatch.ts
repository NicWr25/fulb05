"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { ensureSession, supabaseBrowser } from "@/lib/supabase/browser";
import type { Match, Player } from "@/lib/domain/match";
import type { Layout } from "@/lib/domain/positions";
import type { Format, Team } from "@/lib/domain/teams";

export type MatchStatus = "connecting" | "ready" | "error" | "gone";
/** Estado del canal en vivo (Realtime). */
export type LiveStatus = "connecting" | "live" | "offline";

/** Espera antes de releer tras un evento: agrupa ráfagas (ej. bajarse + ascenso del banco). */
const DEBOUNCE_MS = 150;

/**
 * Estado del partido del lado del cliente.
 *
 * 1. Arranca con lo que renderizó el servidor (`initial`): se ve al instante.
 * 2. Crea/recupera la sesión anónima y llama a open_match(id): "el link es
 *    la llave" → a partir de acá RLS nos deja leer las tablas.
 * 3. Relee el partido con sesión (ahora vienen los user_id → sabemos cuál
 *    inscripción es la nuestra).
 * 4. Se suscribe a Realtime. Ante CUALQUIER cambio, vuelve a leer todo
 *    (con debounce) en vez de aplicar el payload del evento. ¿Por qué?
 *      - Una acción genera varios eventos (bajarse = DELETE + UPDATE del que
 *        asciende del banco): releer una vez deja el estado consistente.
 *      - Los DELETE de Realtime no pasan por RLS ni por el filtro de columna
 *        y solo traen la PK: no alcanzan para actualizar el estado.
 *      - El partido es chico (≤ 26 filas): releer es barato.
 *    También relee al reconectar, al volver a la pestaña y al recuperar
 *    internet, por si se perdió algún evento en el medio.
 */
export function useMatch(initial: Match) {
  const [match, setMatch] = useState<Match>(initial);
  const [uid, setUid] = useState<string | null>(null);
  const [status, setStatus] = useState<MatchStatus>("connecting");
  const [live, setLive] = useState<LiveStatus>("connecting");
  const idRef = useRef(initial.id);
  const playerIdsRef = useRef(new Set(initial.players.map((p) => p.id)));

  const reload = useCallback(async () => {
    const sb = supabaseBrowser();
    const id = idRef.current;
    const [m, p] = await Promise.all([
      sb
        .from("matches")
        .select("id, format, title, venue, maps_url, starts_at, timezone, organizer_name, layout")
        .eq("id", id)
        .maybeSingle(),
      sb
        .from("match_players")
        .select("id, name, team, slot, user_id")
        .eq("match_id", id)
        // El banco se ordena por llegada al banco (el orden en que ascienden).
        .order("bench_since", { ascending: true, nullsFirst: true })
        .order("slot", { ascending: true }),
    ]);
    if (m.error || p.error) throw m.error ?? p.error;
    if (!m.data) {
      setStatus("gone"); // se borró mientras lo mirábamos
      return;
    }
    playerIdsRef.current = new Set(p.data.map((row) => row.id));
    setMatch({
      ...m.data,
      format: m.data.format as Format,
      layout: m.data.layout as Layout | null,
      players: p.data.map((row) => ({ ...row, team: row.team as Team })),
    });
  }, []);

  useEffect(() => {
    const sb = supabaseBrowser();
    const id = idRef.current;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let channel: ReturnType<typeof sb.channel> | null = null;

    // Relee "pronto" (agrupando eventos seguidos en una sola lectura).
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (!cancelled) reload().catch(() => setLive("offline"));
      }, DEBOUNCE_MS);
    };

    const onPlayerChange = (payload: RealtimePostgresChangesPayload<{ id: string }>) => {
      // DELETE: llega de CUALQUIER partido (ver la suscripción más abajo).
      // Solo nos importa si el id es de alguien que tenemos en pantalla.
      if (payload.eventType === "DELETE") {
        const oldId = (payload.old as { id?: string }).id;
        if (!oldId || !playerIdsRef.current.has(oldId)) return;
      }
      schedule();
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") schedule();
    };
    const onOnline = () => schedule();
    const onOffline = () => setLive("offline");

    (async () => {
      try {
        const userId = await ensureSession();
        const { data: exists, error } = await sb.rpc("open_match", { p_match_id: id });
        if (error) throw error;
        if (cancelled) return;
        if (!exists) {
          setStatus("gone");
          return;
        }
        setUid(userId);
        await reload();
        if (cancelled) return;
        setStatus((s) => (s === "gone" ? s : "ready"));

        // El canal usa el JWT de la sesión: Realtime evalúa las políticas
        // SELECT con él, así que solo recibimos filas de partidos que abrimos.
        channel = sb
          .channel(`match:${id}`)
          // INSERT y UPDATE de este partido.
          .on(
            "postgres_changes",
            { event: "INSERT", schema: "public", table: "match_players", filter: `match_id=eq.${id}` },
            onPlayerChange,
          )
          .on(
            "postgres_changes",
            { event: "UPDATE", schema: "public", table: "match_players", filter: `match_id=eq.${id}` },
            onPlayerChange,
          )
          // DELETE SIN filtro: el registro viejo de un DELETE solo trae la PK
          // (replica identity por defecto), así que un filtro por match_id
          // nunca coincidiría y el evento no llegaría. Llega de todos los
          // partidos y onPlayerChange descarta los ids que no son nuestros.
          .on("postgres_changes", { event: "DELETE", schema: "public", table: "match_players" }, onPlayerChange)
          .on("postgres_changes", { event: "*", schema: "public", table: "matches", filter: `id=eq.${id}` }, schedule)
          .subscribe((state) => {
            if (cancelled) return;
            if (state === "SUBSCRIBED") {
              setLive("live");
              // Entre la lectura inicial (o una desconexión) y la suscripción
              // pudo pasar algo: se relee una vez para no perderlo.
              schedule();
            } else if (state === "CHANNEL_ERROR" || state === "TIMED_OUT" || state === "CLOSED") {
              // supabase-js reintenta solo; mientras tanto avisamos en la UI.
              setLive("offline");
            }
          });
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      if (channel) sb.removeChannel(channel);
    };
  }, [reload]);

  const me: Player | null = uid ? (match.players.find((p) => p.user_id === uid) ?? null) : null;

  return { match, uid, me, status, live, reload };
}
