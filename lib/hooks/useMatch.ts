"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ensureSession, supabaseBrowser } from "@/lib/supabase/browser";
import type { Match, Player } from "@/lib/domain/match";
import type { Layout } from "@/lib/domain/positions";
import type { Format, Team } from "@/lib/domain/teams";

export type MatchStatus = "connecting" | "ready" | "error" | "gone";

/**
 * Estado del partido del lado del cliente.
 *
 * 1. Arranca con lo que renderizó el servidor (`initial`): se ve al instante.
 * 2. Crea/recupera la sesión anónima y llama a open_match(id): "el link es
 *    la llave" → a partir de acá RLS nos deja leer las tablas.
 * 3. Relee el partido con sesión. Ahora sí vienen los user_id, y con eso
 *    sabemos cuál inscripción es la nuestra (meId).
 *
 * `reload()` vuelve a leer todo. Se llama después de cada acción y (en la
 * etapa e) ante cada evento de Realtime.
 */
export function useMatch(initial: Match) {
  const [match, setMatch] = useState<Match>(initial);
  const [uid, setUid] = useState<string | null>(null);
  const [status, setStatus] = useState<MatchStatus>("connecting");
  const idRef = useRef(initial.id);

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
    setMatch({
      ...m.data,
      format: m.data.format as Format,
      layout: m.data.layout as Layout | null,
      players: p.data.map((row) => ({ ...row, team: row.team as Team })),
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const userId = await ensureSession();
        const { data: exists, error } = await supabaseBrowser().rpc("open_match", { p_match_id: idRef.current });
        if (error) throw error;
        if (cancelled) return;
        if (!exists) {
          setStatus("gone");
          return;
        }
        setUid(userId);
        await reload();
        if (!cancelled) setStatus((s) => (s === "gone" ? s : "ready"));
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reload]);

  const me: Player | null = uid ? (match.players.find((p) => p.user_id === uid) ?? null) : null;

  return { match, uid, me, status, reload };
}
