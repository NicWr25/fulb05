import { describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Por qué move_token cambia UN punto (jsonb_set) y no el layout entero:
 * si varios jugadores mueven su ficha a la vez, ninguno pisa al otro.
 */

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function anon(): Promise<{ sb: SupabaseClient<Database>; uid: string }> {
  const sb = createClient<Database>(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await sb.auth.signInAnonymously();
  if (error || !data.user) throw error ?? new Error("sin usuario");
  return { sb, uid: data.user.id };
}

describe("mover fichas", () => {
  it("6 jugadores mueven su ficha al mismo tiempo y todos los movimientos quedan", async () => {
    const admin = await anon();
    const date = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
    const { data, error: createError } = await admin.sb.rpc("create_match", {
      p_format: 7, p_title: "", p_venue: "Cancha", p_maps_url: "https://maps.app.goo.gl/abc", p_date: date,
      p_time: "20:00", p_timezone: "America/Montevideo", p_organizer_name: "Ana",
    });
    expect(createError).toBeNull();
    const matchId = (data as { id: string }).id;

    // 6 jugadores de Blanco en los lugares 1..6.
    const players = await Promise.all(Array.from({ length: 6 }, () => anon()));
    for (const [i, p] of players.entries()) {
      await p.sb.rpc("open_match", { p_match_id: matchId });
      const { error } = await p.sb
        .from("match_players")
        .insert({ match_id: matchId, user_id: p.uid, name: `J${i + 1}`, team: "A", slot: i + 1 });
      expect(error).toBeNull();
    }

    // Todos mueven a la vez, cada uno a un lugar distinto de la mitad de Blanco.
    const results = await Promise.all(
      players.map((p, i) =>
        p.sb.rpc("move_token", { p_match_id: matchId, p_team: "A", p_slot: i + 1, p_x: 10 + i * 6, p_y: 20 + i * 10 }),
      ),
    );
    for (const r of results) expect(r.error).toBeNull();

    const { data: m } = await admin.sb.from("matches").select("layout").eq("id", matchId).single();
    const A = (m!.layout as { A: { x: number; y: number }[] }).A;
    players.forEach((_, i) => expect(A[i + 1]).toEqual({ x: 10 + i * 6, y: 20 + i * 10 }));
  });

  it("un jugador no puede cruzar la mitad ni mover la ficha de otro", async () => {
    const [admin, bruno, caro] = await Promise.all([anon(), anon(), anon()]);
    const date = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
    const { data } = await admin.sb.rpc("create_match", {
      p_format: 5, p_title: "", p_venue: "Cancha", p_maps_url: "https://maps.app.goo.gl/abc", p_date: date,
      p_time: "20:00", p_timezone: "America/Montevideo", p_organizer_name: "Ana",
    });
    const matchId = (data as { id: string }).id;
    for (const [c, slot] of [[bruno, 1], [caro, 2]] as const) {
      await c.sb.rpc("open_match", { p_match_id: matchId });
      await c.sb.from("match_players").insert({ match_id: matchId, user_id: c.uid, name: "x", team: "B", slot });
    }

    const cross = await bruno.sb.rpc("move_token", { p_match_id: matchId, p_team: "B", p_slot: 1, p_x: 30, p_y: 50 });
    expect(cross.error?.message).toBe("wrong_half");

    const other = await bruno.sb.rpc("move_token", { p_match_id: matchId, p_team: "B", p_slot: 2, p_x: 70, p_y: 50 });
    expect(other.error?.message).toBe("not_your_token");
  });
});
