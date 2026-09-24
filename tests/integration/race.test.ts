import { beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { errorKind, errorMessage, SLOT_TAKEN_MESSAGE } from "@/lib/domain/errors";

/**
 * Concurrencia real: dos navegadores distintos (dos usuarios anónimos) contra
 * la API de Supabase local, al mismo tiempo. Verifica de punta a punta que
 * RLS + UNIQUE + triggers + la traducción de errores funcionan juntos.
 */

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function anonClient(): Promise<{ sb: SupabaseClient<Database>; uid: string }> {
  const sb = createClient<Database>(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await sb.auth.signInAnonymously();
  if (error || !data.user) throw error ?? new Error("sin usuario");
  return { sb, uid: data.user.id };
}

function nextWeek(): string {
  const d = new Date(Date.now() + 7 * 24 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}

describe("carreras por el mismo lugar", () => {
  let matchId: string;
  let ana: Awaited<ReturnType<typeof anonClient>>;
  let bruno: Awaited<ReturnType<typeof anonClient>>;
  let caro: Awaited<ReturnType<typeof anonClient>>;

  beforeAll(async () => {
    if (!URL || !KEY) throw new Error("Faltan variables: copiá .env.example a .env.local");
    [ana, bruno, caro] = await Promise.all([anonClient(), anonClient(), anonClient()]);

    const { data, error } = await ana.sb.rpc("create_match", {
      p_format: 5,
      p_title: "",
      p_venue: "Cancha de test",
      p_maps_url: "",
      p_date: nextWeek(),
      p_time: "21:00",
      p_timezone: "America/Montevideo",
      p_organizer_name: "Ana",
    });
    if (error) throw error;
    matchId = (data as { id: string }).id;

    for (const c of [bruno, caro]) {
      const { data: ok } = await c.sb.rpc("open_match", { p_match_id: matchId });
      expect(ok).toBe(true);
    }
  });

  it("dos personas eligen el mismo lugar a la vez: una entra y la otra recibe 'lugar ocupado'", async () => {
    const [r1, r2] = await Promise.all(
      [bruno, caro].map((c, i) =>
        c.sb.from("match_players").insert({
          match_id: matchId,
          user_id: c.uid,
          name: i === 0 ? "Bruno" : "Caro",
          team: "A",
          slot: 2,
        }),
      ),
    );

    const errors = [r1.error, r2.error].filter(Boolean);
    expect(errors).toHaveLength(1);
    expect(errorKind(errors[0])).toBe("slot_taken");
    expect(errorMessage(errors[0])).toBe(SLOT_TAKEN_MESSAGE);

    const { data } = await ana.sb.from("match_players").select("name, slot").eq("match_id", matchId);
    expect(data).toHaveLength(1);
    expect(data![0].slot).toBe(2);
  });

  it("dos personas se anotan sin elegir lugar a la vez: las dos entran, en lugares distintos", async () => {
    // Limpia: Ana (admin) saca a quien haya quedado del test anterior.
    await ana.sb.from("match_players").delete().eq("match_id", matchId);

    const results = await Promise.all(
      [bruno, caro].map((c, i) =>
        c.sb
          .from("match_players")
          .insert({ match_id: matchId, user_id: c.uid, name: i === 0 ? "Bruno" : "Caro", team: "B", slot: null })
          .select("slot")
          .single(),
      ),
    );
    // El INSERT devuelve la fila recién insertada (slot null); el lugar lo asigna
    // el trigger AFTER, así que se relee.
    for (const r of results) expect(r.error).toBeNull();

    const { data } = await ana.sb
      .from("match_players")
      .select("slot")
      .eq("match_id", matchId)
      .eq("team", "B")
      .order("slot");
    expect(data!.map((r) => r.slot)).toEqual([0, 1]);
  });

  it("nadie puede sacar a otro (salvo el admin)", async () => {
    const { data: caroRow } = await caro.sb.from("match_players").select("id").eq("user_id", caro.uid).single();
    const { data: deleted } = await bruno.sb.from("match_players").delete().eq("id", caroRow!.id).select();
    expect(deleted).toEqual([]); // RLS: para Bruno esa fila "no existe"

    const { data: deletedByAdmin } = await ana.sb.from("match_players").delete().eq("id", caroRow!.id).select();
    expect(deletedByAdmin).toHaveLength(1);
  });
});
