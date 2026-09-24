"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { StatBox } from "@/components/ui/StatBox";
import { MatchHeader } from "./MatchHeader";
import { MatchLayout } from "./MatchLayout";
import { MatchPitch, type SlotRef } from "./MatchPitch";
import { QuickAddBar } from "./QuickAddBar";
import { AliasEditor } from "./AliasEditor";
import { MyEntryCard } from "./MyEntryCard";
import { ShareIconLink, ShareWideLink } from "./ShareButtons";
import { supabaseBrowser } from "@/lib/supabase/browser";
import type { MatchState } from "@/lib/hooks/useMatch";
import { formatMatchDate } from "@/lib/domain/datetime";
import { errorKind, errorMessage, SLOT_TAKEN_MESSAGE } from "@/lib/domain/errors";
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
 * Inscripción y movimientos escriben directo en match_players: RLS limita
 * las filas y los triggers validan lugar y cierre. Editar el alias usa una
 * RPC que también valida la identidad. El cliente solo traduce los errores.
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

  // Si el lugar elegido lo ocupó otra persona (se ve al recargar), la
  // selección deja de valer. Se deriva en el render, sin efectos.
  const selected = picked && !slots[picked.team][picked.slot] && picked.slot < match.format ? picked : null;
  const teamFull = (t: Team) => slots[t].every(Boolean);
  const targetTeam = selected?.team ?? team;
  const duplicateName = hasNameInTeam(name, targetTeam, match.players);

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
    if (playerNameError(name) || playerAliasError(alias) || !uid) return;
    // Sin lugar elegido, la base asigna el primer lugar libre o rechaza el alta.
    const target = selected ?? { team, slot: null as unknown as number };
    await run(() =>
      supabaseBrowser().from("match_players").insert({
        match_id: match.id,
        user_id: uid,
        name: name.trim(),
        alias: alias.trim() || null,
        team: target.team,
        slot: target.slot,
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
  const title = matchTitle(match.title, match.organizer_name);
  const when = formatMatchDate(match.starts_at, match.timezone);
  const missing = missingCount(match);

  let hint = "Sin lugar elegido: primer lugar libre del equipo.";
  if (selected) hint = `Vas al lugar ${selected.slot + 1} en ${TEAM_IN[selected.team]}.`;
  else if (teamFull(team)) hint = `${TEAM_IN[team][0].toUpperCase() + TEAM_IN[team].slice(1)} está completo.`;

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
              team={targetTeam}
              onTeam={chooseTeam}
              teamDisabled={(value) => !ready || teamFull(value)}
              hint={notice ?? (duplicateName ? "Ya hay alguien con ese nombre en el equipo. Podés usar un alias; si no, se verá el número del lugar." : hint)}
              error={error}
              placeholder="Tu nombre"
              submitLabel={!ready ? "Conectando…" : "Anotarme"}
              busy={busy}
              disabled={!ready || (!selected && teamFull(team))}
              onSubmit={join}
            />
          )}
          {!closed && me && <MyEntryCard
            name={me.name}
            line={`Jugás en ${TEAM_IN[me.team]}.`}
            moveHint={selected ? `Elegiste el lugar ${selected.slot + 1} en ${TEAM_IN[selected.team]}.` : "Tocá un lugar libre para cambiarte; arrastrá tu ficha para acomodarte."}
            error={error} canMove={Boolean(selected)} busy={busy}
            onMove={move} onLeave={leave}
          />}
          {!closed && me && <div className="flex flex-col gap-2">
            {editAlias === null ? <button type="button" onClick={() => setEditAlias(me.alias ?? "")}
              className="min-h-11 self-start rounded-btn border border-line-strong bg-surface px-3 text-13 font-semibold">Editar alias en la cancha</button>
              : <AliasEditor value={editAlias} onChange={setEditAlias} onSave={saveAlias}
                  onCancel={() => setEditAlias(null)} busy={busy} error={playerAliasError(editAlias) ?? error} />}
          </div>}
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
                ? "Arrastrá tu ficha dentro de tu mitad o tocá un lugar libre para cambiarte."
                : "Tocá un lugar libre para elegirlo. Cuando estés anotado, vas a poder arrastrar tu ficha."}
          </p>
        </>
      }
      card={card}
      share={<ShareWideLink href={shareHref} />}
    />
  );
}
