"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { StatBox } from "@/components/ui/StatBox";
import { MatchHeader } from "./MatchHeader";
import { MatchLayout } from "./MatchLayout";
import { MatchPitch, type SlotRef } from "./MatchPitch";
import { QuickAddBar } from "./QuickAddBar";
import { TeamChoice } from "./TeamChoice";
import { AliasEditor } from "./AliasEditor";
import { MyEntryCard } from "./MyEntryCard";
import { ShareIconLink, ShareWideLink } from "./ShareButtons";
import { supabaseBrowser } from "@/lib/supabase/browser";
import type { MatchState } from "@/lib/hooks/useMatch";
import { formatMatchDate } from "@/lib/domain/datetime";
import { errorMessage } from "@/lib/domain/errors";
import { entryDestination } from "@/lib/domain/entry";
import { hasNameInTeam, missingCount, missingLabel, slotsByTeam } from "@/lib/domain/match";
import { type Point } from "@/lib/domain/positions";
import { matchTitle } from "@/lib/domain/share";
import { TEAM_IN, type Team } from "@/lib/domain/teams";
import { playerAliasError, playerNameError } from "@/lib/domain/validation";

type AnyError = Parameters<typeof errorMessage>[0];

/**
 * Vista del jugador (diseño: design/jugador-*.dc.html), interactiva.
 * El servidor ya pintó el estado inicial; acá se suman la sesión y las acciones.
 *
 * La inscripción pasa por join_match: la base asigna el lugar y guarda la
 * posición inicial de una vez. El arrastre posterior usa move_token.
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
  const { match, uid, me, status, arrivingIds, swapMoves, reload } = state;
  const [name, setName] = useState("");
  const [alias, setAlias] = useState("");
  const [editAlias, setEditAlias] = useState<string | null>(null);
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
  const ready = status === "ready";

  const teamFull = (t: Team) => slots[t].every(Boolean);
  const duplicateName = hasNameInTeam(name, team, match.players);

  function chooseTeam(t: Team) {
    setError(null);
    setTeam(t);
  }

  /** Corre una escritura, traduce el error si lo hay y siempre relee el estado. */
  async function run(action: () => PromiseLike<{ error: AnyError }>): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      const { error: err } = await action();
      if (err) {
        setError(errorMessage(err));
        return false;
      }
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
    if (playerNameError(name) || playerAliasError(alias) || !uid) return;
    const point = entryDestination(match, team);
    await run(() =>
      supabaseBrowser().rpc("join_match", {
        p_match_id: match.id,
        p_team: team,
        p_name: name.trim(),
        p_alias: alias.trim(),
        p_x: point.x,
        p_y: point.y,
        p_guest: false,
      }),
    );
  }

  async function saveAlias() {
    if (!me || editAlias === null || playerAliasError(editAlias)) return;
    const ok = await run(() => supabaseBrowser().rpc("set_player_alias", {
      p_match_id: match.id, p_player_id: me.id, p_alias: editAlias.trim(),
    }));
    if (ok) setEditAlias(null);
  }

  async function changeTeam(next: Team) {
    if (!me || next === me.team) return;
    await run(() => supabaseBrowser().rpc("change_player_team", {
      p_match_id: match.id, p_player_id: me.id, p_team: next,
    }));
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
  const title = matchTitle(match.title, match.organizer_name);
  const when = formatMatchDate(match.starts_at, match.timezone);
  const missing = missingCount(match);

  let hint = "Te asignamos el primer lugar libre del equipo. Después podés mover tu ficha.";
  if (teamFull(team)) hint = `${TEAM_IN[team][0].toUpperCase() + TEAM_IN[team].slice(1)} está completo.`;

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
  }

  return (
    <MatchLayout
      header={
        <MatchHeader
          eyebrow={closed ? "Partido cerrado" : undefined}
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
          {!closed && !me && (
            <QuickAddBar
              name={name}
              onName={(value) => { setName(value); setError(null); }}
              nameError={tried ? playerNameError(name) : null}
              alias={alias}
              onAlias={(value) => { setAlias(value); setError(null); }}
              aliasError={tried ? playerAliasError(alias) : null}
              showAlias={duplicateName || Boolean(alias)}
              team={team}
              onTeam={chooseTeam}
              teamDisabled={(value) => !ready || teamFull(value)}
              hint={notice ?? (duplicateName ? "Ya hay alguien con ese nombre en el equipo. Podés usar un alias; si no, se verá el número del lugar." : hint)}
              error={error}
              placeholder="Tu nombre"
              submitLabel={!ready ? "Conectando…" : "Anotarme"}
              busy={busy}
              disabled={!ready || teamFull(team)}
              onSubmit={join}
            />
          )}
          {!closed && me && <MyEntryCard
            name={me.name}
            line={`Jugás en ${TEAM_IN[me.team]}.`}
            hint="Arrastrá tu ficha para acomodarte."
            error={error} busy={busy} editingAlias={editAlias !== null}
            onEditAlias={() => setEditAlias(me.alias ?? "")}
            onLeave={leave}
          />}
          {!closed && me && editAlias !== null && <AliasEditor value={editAlias} onChange={setEditAlias} onSave={saveAlias}
            onCancel={() => setEditAlias(null)} busy={busy} error={playerAliasError(editAlias) ?? error} />}
          {!closed && me && <TeamChoice team={me.team} label="Tu equipo"
            onTeam={(next) => { void changeTeam(next); }}
            unavailable={teamFull} busy={!ready || busy} />}
          <MatchPitch
            match={match}
            meId={me?.id}
            arrivingIds={arrivingIds}
            swapMoves={swapMoves}
            // Solo tu propia ficha se arrastra.
            canDrag={(_, player) => !closed && Boolean(me && player.id === me.id)}
            onMove={moveToken}
            disabled={busy}
          />
          <p className="text-13 leading-[1.45] text-ink-2">
            {closed
              ? "El partido ya empezó: la cancha queda como estaba."
              : me?.slot != null
                ? "Arrastrá tu ficha dentro de tu mitad para acomodarte. Usá los botones para cambiar de equipo."
                : "Elegí tu equipo y anotate. Después vas a poder arrastrar tu ficha para acomodarte."}
          </p>
        </>
      }
      card={card}
      share={<ShareWideLink href={shareHref} />}
    />
  );
}
