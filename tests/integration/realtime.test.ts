import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Realtime + RLS, contra el Supabase local. Documenta dos comportamientos
 * que el hook useMatch da por sentados:
 *   1. Quien NO abrió el link no recibe eventos (RLS aplica al canal).
 *   2. Los DELETE no llegan a una suscripción filtrada por match_id (el
 *      registro viejo solo trae la PK), pero sí a una sin filtro, con el id.
 */

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
type Client = SupabaseClient<Database>;

async function anon(): Promise<{ sb: Client; uid: string }> {
  const sb = createClient<Database>(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await sb.auth.signInAnonymously();
  if (error || !data.user) throw error ?? new Error("sin usuario");
  return { sb, uid: data.user.id };
}

type Event = { kind: string; type: string; old: Record<string, unknown> };

/** Se suscribe como en useMatch y junta los eventos que llegan. */
function listen(sb: Client, matchId: string): Promise<{ events: Event[]; stop: () => void }> {
  const events: Event[] = [];
  return new Promise((resolve, reject) => {
    const ch = sb
      .channel(`test:${matchId}:${Math.random()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "match_players", filter: `match_id=eq.${matchId}` }, (p) =>
        events.push({ kind: "filtered", type: p.eventType, old: p.old }),
      )
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "match_players" }, (p) =>
        events.push({ kind: "unfiltered", type: p.eventType, old: p.old }),
      )
      .subscribe((s) => {
        if (s === "SUBSCRIBED") resolve({ events, stop: () => void sb.removeChannel(ch) });
        if (s === "CHANNEL_ERROR" || s === "TIMED_OUT") reject(new Error(s));
      });
  });
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Espera hasta que se cumpla la condición (o se venza el plazo). Mejor que
 * esperar un tiempo fijo: en una máquina lenta (CI) los eventos tardan más.
 */
async function waitFor(cond: () => boolean, timeoutMs = 10_000): Promise<boolean> {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > timeoutMs) return false;
    await wait(100);
  }
  return true;
}

describe("Realtime", () => {
  let admin: Awaited<ReturnType<typeof anon>>;
  let viewer: Awaited<ReturnType<typeof anon>>;
  let stranger: Awaited<ReturnType<typeof anon>>;
  let matchId: string;

  beforeAll(async () => {
    [admin, viewer, stranger] = await Promise.all([anon(), anon(), anon()]);
    const date = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
    const { data, error } = await admin.sb.rpc("create_match", {
      p_format: 5, p_title: "", p_venue: "Cancha RT", p_maps_url: "https://maps.app.goo.gl/abc", p_date: date,
      p_time: "20:00", p_timezone: "America/Montevideo", p_organizer_name: "Ana",
    });
    if (error) throw error;
    matchId = (data as { id: string }).id;
    await viewer.sb.rpc("open_match", { p_match_id: matchId });
  });

  afterAll(async () => {
    await Promise.all([admin, viewer, stranger].map((c) => c?.sb.removeAllChannels()));
  });

  it("quien abrió el link recibe INSERT y DELETE; quien no, nada", async () => {
    const [v, s] = await Promise.all([listen(viewer.sb, matchId), listen(stranger.sb, matchId)]);

    // Un canal puede responder SUBSCRIBED un instante antes de empezar a leer
    // los cambios (sobre todo con Realtime recién levantado, como en CI). Si
    // el primer INSERT se pierde, se reintenta con otro: lo que se prueba es
    // que los eventos llegan a quien corresponde, no la latencia del primero.
    let rowId: string | null = null;
    for (let attempt = 0; attempt < 5 && !rowId; attempt++) {
      const { data: row, error } = await admin.sb
        .from("match_players")
        .insert({ match_id: matchId, user_id: null, name: `Invitado ${attempt}`, team: "A", slot: null as unknown as number })
        .select("id")
        .single();
      expect(error).toBeNull();
      const received = await waitFor(() => v.events.some((e) => e.kind === "filtered" && e.type === "INSERT"), 3000);
      if (received) rowId = row!.id;
      else await admin.sb.from("match_players").delete().eq("id", row!.id);
    }
    expect(rowId, "el viewer nunca recibió un INSERT").not.toBeNull();

    await admin.sb.from("match_players").delete().eq("id", rowId!);
    expect(await waitFor(() => v.events.some((e) => e.kind === "unfiltered" && e.old.id === rowId))).toBe(true);
    await wait(500); // margen para que llegue cualquier evento de más al "espía"
    v.stop();
    s.stop();

    // El viewer recibe el INSERT por la suscripción filtrada...
    expect(v.events.some((e) => e.kind === "filtered" && e.type === "INSERT")).toBe(true);
    // ...el DELETE NO llega por la filtrada (el registro viejo no trae match_id)...
    expect(v.events.some((e) => e.kind === "filtered" && e.type === "DELETE")).toBe(false);
    // ...y SÍ por la sin filtro, solo con la PK. (Pueden llegar también DELETE
    // de OTROS partidos, ej. de race.test.ts corriendo en paralelo: por eso
    // useMatch compara el id con los jugadores que tiene en pantalla.)
    const del = v.events.find((e) => e.kind === "unfiltered" && e.old.id === rowId);
    expect(del?.old).toEqual({ id: rowId });

    // Quien no abrió el link: ningún INSERT/UPDATE (RLS). Puede ver el DELETE
    // sin filtro, pero solo es un UUID sin datos.
    expect(s.events.filter((e) => e.type !== "DELETE")).toEqual([]);
  }, 40_000); // peor caso: 5 reintentos de 3 s + la espera del DELETE
});
