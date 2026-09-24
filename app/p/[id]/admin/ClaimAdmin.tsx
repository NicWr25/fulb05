"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { ensureSession, supabaseBrowser } from "@/lib/supabase/browser";
import { errorMessage } from "@/lib/domain/errors";

type State = { kind: "checking" } | { kind: "invalid" } | { kind: "error"; message: string };

export function ClaimAdmin({ matchId }: { matchId: string }) {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "checking" });
  // Tokens ya procesados: en desarrollo React monta los efectos dos veces
  // (StrictMode), y la segunda vez el # ya se habría borrado.
  const tried = useRef(new Set<string>());

  useEffect(() => {
    async function claim(token: string) {
      try {
        if (!token) return setState({ kind: "invalid" });
        setState({ kind: "checking" });
        await ensureSession();
        const { data: ok, error } = await supabaseBrowser().rpc("claim_admin", {
          p_match_id: matchId,
          p_token: token,
        });
        if (error) throw error;
        if (!ok) return setState({ kind: "invalid" });
        router.replace(`/p/${matchId}`);
      } catch (err) {
        setState({ kind: "error", message: errorMessage(err as Parameters<typeof errorMessage>[0]) });
      }
    }

    function readHash() {
      const token = window.location.hash.slice(1);
      if (!token) {
        if (tried.current.size === 0) setState({ kind: "invalid" });
        return;
      }
      // Se borra el token de la barra de direcciones y del historial enseguida:
      // así no queda a la vista ni se comparte por error al copiar la URL.
      window.history.replaceState(null, "", window.location.pathname);
      if (tried.current.has(token)) return;
      tried.current.add(token);
      void claim(token);
    }

    readHash();
    // Si pegan otro enlace en la misma pestaña, solo cambia el # (no recarga).
    window.addEventListener("hashchange", readHash);
    // Sin bandera de "cancelado" a propósito: en StrictMode el primer montaje
    // es el que lanza el reclamo y su resultado es el que vale.
    return () => window.removeEventListener("hashchange", readHash);
  }, [matchId, router]);

  return (
    <main className="mx-auto flex w-full max-w-[440px] flex-col gap-4 px-4 pt-10 pb-8" aria-live="polite">
      <Eyebrow>Panel del organizador</Eyebrow>
      {state.kind === "checking" && (
        <>
          <h1 className="font-display text-30 leading-[1.05] font-extrabold">Verificando tu enlace…</h1>
          <p className="text-16 text-ink-2">Un segundo.</p>
        </>
      )}
      {state.kind !== "checking" && (
        <>
          <h1 className="font-display text-30 leading-[1.05] font-extrabold">
            {state.kind === "invalid" ? "Ese enlace de organizador no es válido" : "No pudimos verificar el enlace"}
          </h1>
          <p className="text-16 leading-normal text-ink-2">
            {state.kind === "invalid"
              ? "Revisá que lo hayas copiado completo (incluida la parte después del #). Igual podés ver el partido como jugador."
              : state.message}
          </p>
          <Link
            href={`/p/${matchId}`}
            className="mt-2 flex h-13 items-center justify-center rounded-btn bg-ink text-16 font-semibold text-white no-underline hover:text-white"
          >
            Ver el partido
          </Link>
        </>
      )}
    </main>
  );
}
