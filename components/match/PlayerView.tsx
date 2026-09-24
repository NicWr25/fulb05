"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { StatBox } from "@/components/ui/StatBox";
import { MatchHeader } from "./MatchHeader";
import { MatchLayout } from "./MatchLayout";
import { MatchPitch, type SlotRef } from "./MatchPitch";
import { JoinCard } from "./JoinCard";
import { MyEntryCard } from "./MyEntryCard";
import { Rosters } from "./Rosters";
import { ShareIconLink, ShareWideLink } from "./ShareButtons";
import { TeamLegend } from "./TeamLegend";
import { supabaseBrowser } from "@/lib/supabase/browser";
import type { MatchState } from "@/lib/hooks/useMatch";
import { formatMatchDate, weekday } from "@/lib/domain/datetime";
import { errorKind, errorMessage, SLOT_TAKEN_MESSAGE } from "@/lib/domain/errors";
import { missingCount, missingLabel, slotsByTeam } from "@/lib/domain/match";
import { ROLE_NAME, slotRoles, type Point } from "@/lib/domain/positions";
import { matchTitle } from "@/lib/domain/share";
import { TEAM_LABEL, type Team } from "@/lib/domain/teams";
import { playerNameError } from "@/lib/domain/validation";

type AnyError = Parameters<typeof errorMessage>[0];

/**
 * Vista del jugador (diseño: design/jugador-*.dc.html), interactiva.
 * El servidor ya pintó el estado inicial; acá se suman la sesión y las acciones.
 *
 * Las acciones escriben DIRECTO en match_players: las reglas las hacen
 * cumplir RLS (solo como vos mismo, solo tu fila) y los triggers (lugar
 * válido, cierre, banco). El cliente solo traduce los errores.
 */
export function PlayerView({
  state,
  closed,
  shareHref,
}: {
  state: MatchState;
  closed: boolean;
  shareHref: string;
}) {
  const { match, uid, me, status, reload } = state;
  const [picked, setPicked] = useState<SlotRef | null>(null);
  const [name, setName] = useState("");
  const [team, setTeam] = useState<Team>("A");
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [prevMeId, setPrevMeId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Si mi inscripción desaparece sin que yo me haya bajado, me sacó el
  // organizador (llega por Realtime). Patrón de React "guardar el valor del
  // render anterior en el estado": se compara durante el render, sin efectos.
  const meId = me?.id ?? null;
  if (meId !== prevMeId) {
    setPrevMeId(meId);
    if (prevMeId && !meId && !leaving) setNotice("El organizador te sacó del partido. Si querés, podés volver a anotarte.");
    if (meId) setNotice(null);
  }

  const slots = slotsByTeam(match);
  const roles = slotRoles(match.format);
  const ready = status === "ready";

  // Si el lugar elegido lo ocupó otra persona (se ve al recargar), la
  // selección deja de valer. Se deriva en el render, sin efectos.
  const selected = picked && !slots[picked.team][picked.slot] && picked.slot < match.format ? picked : null;
  const teamFull = (t: Team) => slots[t].every(Boolean);
  const roleOf = (ref: SlotRef) => ROLE_NAME[roles[ref.slot]];

  function pick(ref: SlotRef) {
    setError(null);
    const same = selected?.team === ref.team && selected.slot === ref.slot;
    setPicked(same ? null : ref);
    if (!me) setTeam(ref.team);
  }

  function chooseTeam(t: Team) {
    setError(null);
    setTeam(t);
    if (selected && selected.team !== t) setPicked(null);
  }

  /** Corre una escritura, traduce el error si lo hay y siempre relee el estado. */
  async function run(action: () => PromiseLike<{ error: AnyError }>): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      const { error: err } = await action();
      if (err) {
        if (errorKind(err) === "slot_taken") {
          setPicked(null);
          setError(SLOT_TAKEN_MESSAGE);
        } else {
          setError(errorMessage(err));
        }
        return false;
      }
      setPicked(null);
      return true;
    } catch (err) {
      setError(errorMessage(err as AnyError));
      return false;
    } finally {
      await reload().catch(() => {});
      setBusy(false);
    }
  }

  async function join() {
    setTried(true);
    if (playerNameError(name) || !uid) return;
    // Sin lugar elegido: slot null = "primer lugar libre, o el banco" (lo resuelve la base).
    const target = selected ?? { team, slot: null };
    await run(() =>
      supabaseBrowser().from("match_players").insert({
        match_id: match.id,
        user_id: uid,
        name: name.trim(),
        team: target.team,
        slot: target.slot,
      }),
    );
  }

  async function move() {
    if (!me || !selected) return;
    await run(() =>
      supabaseBrowser().from("match_players").update({ team: selected.team, slot: selected.slot }).eq("id", me.id),
    );
  }

  /** Mover mi propia ficha (la RPC valida que sea mía y que quede en mi mitad). */
  async function moveToken(ref: SlotRef, point: Point): Promise<boolean> {
    setError(null);
    const { error: err } = await supabaseBrowser().rpc("move_token", {
      p_match_id: match.id,
      p_team: ref.team,
      p_slot: ref.slot,
      p_x: point.x,
      p_y: point.y,
    });
    if (err) setError(errorMessage(err));
    return !err;
  }

  async function leave() {
    if (!me) return;
    const myName = me.name;
    setLeaving(true);
    const ok = await run(() => supabaseBrowser().from("match_players").delete().eq("id", me.id));
    setLeaving(false);
    if (ok) setName(myName); // por si se quiere volver a anotar
  }

  // --- Textos ---------------------------------------------------------------
  const title = matchTitle(match.title, weekday(match.starts_at, match.timezone));
  const when = formatMatchDate(match.starts_at, match.timezone);
  const missing = missingCount(match);

  let hint = "Tocá un puesto libre en la cancha para elegir dónde jugás, o anotate y te toca el primer lugar libre.";
  if (selected) hint = `Vas a jugar de ${roleOf(selected)} en ${TEAM_LABEL[selected.team]}.`;
  else if (teamFull(team)) hint = `${TEAM_LABEL[team]} está completo: te anotás al banco y entrás si se libera un lugar.`;

  let card: React.ReactNode = null;
  if (closed) {
    card = null;
  } else if (status === "error") {
    card = (
      <Card>
        <CardTitle>No pudimos conectarnos</CardTitle>
        <p className="text-14 leading-[1.45] text-ink-2">Revisá tu conexión. Mientras tanto, ves el partido como estaba al abrirlo.</p>
        <Button size="md" onClick={() => window.location.reload()}>
          Reintentar
        </Button>
      </Card>
    );
  } else if (me) {
    const myRef = me.slot !== null ? { team: me.team, slot: me.slot } : null;
    card = (
      <MyEntryCard
        name={me.name}
        line={
          myRef
            ? `Jugás de ${roleOf(myRef)} en ${TEAM_LABEL[me.team]}.`
            : `Estás en el banco de ${TEAM_LABEL[me.team]}. Si se libera un lugar, entrás vos.`
        }
        moveHint={
          selected
            ? `Elegiste el puesto de ${roleOf(selected)} en ${TEAM_LABEL[selected.team]}.`
            : myRef
              ? "Arrastrá tu ficha para acomodarte. ¿Querés otro puesto? Tocá uno libre en la cancha."
              : "¿Querés cambiar de lugar? Tocá un puesto libre en la cancha."
        }
        error={error}
        canMove={Boolean(selected)}
        busy={busy}
        onMove={move}
        onLeave={leave}
      />
    );
  } else {
    card = (
      <JoinCard
        name={name}
        onName={(v) => {
          setName(v);
          setError(null);
        }}
        nameError={tried ? playerNameError(name) : null}
        team={team}
        onTeam={chooseTeam}
        hint={notice ?? hint}
        error={error}
        submitLabel={!ready ? "Conectando…" : !selected && teamFull(team) ? "Anotarme al banco" : "Anotarme"}
        busy={busy}
        disabled={!ready}
        onSubmit={join}
      />
    );
  }

  return (
    <MatchLayout
      header={
        <MatchHeader
          eyebrow={closed ? "Partido cerrado" : "Partido entre amigos"}
          title={title}
          when={when}
          venue={match.venue}
          mapsUrl={match.maps_url}
          organizer={match.organizer_name}
          action={<ShareIconLink href={shareHref} />}
        />
      }
      stat={
        closed ? (
          <StatBox value="—" title="Las inscripciones cerraron" subtitle="El partido ya empezó." />
        ) : (
          <StatBox
            value={missing}
            title={missingLabel(missing)}
            subtitle={`${match.format} vs ${match.format} · ${match.format * 2} jugadores en cancha`}
          />
        )
      }
      pitch={
        <>
          <TeamLegend />
          <MatchPitch
            match={match}
            meId={me?.id}
            selected={selected}
            // Solo tu propia ficha se arrastra; solo los lugares libres se eligen.
            canDrag={(_, player) => !closed && Boolean(me && player?.id === me.id)}
            canSelect={(_, player) => !closed && !player}
            onSelect={pick}
            onMove={moveToken}
            disabled={busy}
          />
          <p className="text-13 leading-[1.45] text-ink-2">
            {closed
              ? "El partido ya empezó: la cancha queda como estaba."
              : me?.slot != null
                ? "Arrastrá tu ficha para acomodarte donde quieras jugar, dentro de tu mitad. Tocá un puesto libre para cambiarte."
                : "Tocá un puesto libre para elegirlo. Cuando estés anotado, vas a poder arrastrar tu ficha."}
          </p>
        </>
      }
      card={card}
      rosters={<Rosters match={match} meId={me?.id} />}
      share={<ShareWideLink href={shareHref} />}
    />
  );
}
