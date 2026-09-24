"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { errorMessage } from "@/lib/domain/errors";
import type { MatchState } from "@/lib/hooks/useMatch";
import type { Team } from "@/lib/domain/teams";

/** Recupera un alta interrumpida antes de que el creador eligiera equipo. */
export function OrganizerSetup({ state }: { state: MatchState }) {
  const [team, setTeam] = useState<Team>("A");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function join() {
    if (!state.uid) return;
    setBusy(true); setError(null);
    const result = await supabaseBrowser().from("match_players").insert({
      match_id: state.match.id, user_id: state.uid,
      name: state.match.organizer_name, team, slot: null as unknown as number,
    });
    if (result.error) setError(errorMessage(result.error));
    else await state.reload();
    setBusy(false);
  }
  return <main className="mx-auto max-w-[440px] px-4 pt-8"><Card panel>
    <h1 className="font-display text-24 font-extrabold">Elegí tu equipo</h1>
    <p className="mt-2 text-14 text-ink-2">Primero te anotamos a vos como {state.match.organizer_name}. Después podés invitar al resto.</p>
    <div className="mt-4 flex gap-2">{(["A", "B"] as const).map((value) => <button key={value} type="button" aria-pressed={team === value} onClick={() => setTeam(value)} className={`min-h-11 flex-1 rounded-btn border px-3 font-semibold ${team === value ? "border-ink bg-ink text-white" : "border-line-strong bg-surface text-ink"}`}>{value === "A" ? "Blanco" : "Negro"}</button>)}</div>
    {error && <p role="alert" className="mt-2 text-13 text-danger">{error}</p>}
    <Button onClick={join} disabled={busy || state.status !== "ready"} className="mt-4 w-full">{busy ? "Anotando…" : "Anotarme y ver el panel"}</Button>
  </Card></main>;
}
