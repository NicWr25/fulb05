"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { StatBox } from "@/components/ui/StatBox";
import { TeamSwatch } from "@/components/ui/TeamSwatch";
import { EditIcon, ResetIcon } from "@/components/ui/icons";
import { AddPlayerCard } from "./AddPlayerCard";
import { useEditMatchDialog } from "./EditMatchDialog";
import { MatchHeader } from "./MatchHeader";
import { MatchLayout } from "./MatchLayout";
import { MatchPitch, type SlotRef } from "./MatchPitch";
import { Rosters } from "./Rosters";
import { ShareIconLink, ShareWideLink } from "./ShareButtons";
import { supabaseBrowser } from "@/lib/supabase/browser";
import type { MatchState } from "@/lib/hooks/useMatch";
import { formatMatchDate, toLocalInputs, weekday } from "@/lib/domain/datetime";
import { errorMessage } from "@/lib/domain/errors";
import { missingCount, missingLabel, slotsByTeam, type Player } from "@/lib/domain/match";
import { ROLE_NAME, slotRoles, type Point } from "@/lib/domain/positions";
import { matchTitle } from "@/lib/domain/share";
import { TEAM_LABEL, type Format, type Team } from "@/lib/domain/teams";
import { playerNameError } from "@/lib/domain/validation";

type AnyError = Parameters<typeof errorMessage>[0];

/**
 * Panel del organizador (diseño: design/organizador-*.dc.html).
 *
 * Todas las acciones de admin se validan en la base:
 *   - agregar sin user_id / sacar a otro → políticas RLS con is_match_admin()
 *   - editar datos / formato / posiciones → RPC security definer que
 *     verifican is_match_admin() antes de tocar nada.
 * Si alguien forzara este panel en su navegador sin ser admin, cada acción
 * fallaría con "Solo el organizador puede hacer eso".
 */
export function OrganizerView({ state, closed, shareHref }: { state: MatchState; closed: boolean; shareHref: string }) {
  const { match, uid, me, status, reload } = state;
  const [selected, setSelected] = useState<SlotRef | null>(null);
  const [name, setName] = useState("");
  const [team, setTeam] = useState<Team>("A");
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const sb = supabaseBrowser();
  const slots = slotsByTeam(match);
  const roles = slotRoles(match.format);
  const ready = status === "ready";
  const current = selected && selected.slot < match.format ? selected : null;
  const occupant = current ? slots[current.team][current.slot] : null;
  const teamFull = (t: Team) => slots[t].every(Boolean);
  const targetTeam = current ? current.team : team;

  /** Datos actuales del partido en el formato que espera update_match. */
  function details() {
    const { date, time } = toLocalInputs(match.starts_at, match.timezone);
    return {
      p_match_id: match.id,
      p_format: match.format,
      p_title: match.title ?? "",
      p_venue: match.venue,
      p_maps_url: match.maps_url ?? "",
      p_date: date,
      p_time: time,
      p_timezone: match.timezone,
      p_organizer_name: match.organizer_name,
    };
  }

  /** Corre una acción, muestra el error traducido si falla y relee el estado. */
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

  // --- Acciones -------------------------------------------------------------
  function select(ref: SlotRef) {
    setError(null);
    const same = current?.team === ref.team && current.slot === ref.slot;
    setSelected(same ? null : ref);
    setTeam(ref.team);
  }

  function chooseTeam(t: Team) {
    setTeam(t);
    if (current && current.team !== t) setSelected(null);
  }

  /** Destino de un alta: el lugar elegido si está libre; si no, slot null (primer libre o banco). */
  function target() {
    return { team: targetTeam, slot: current && !occupant ? current.slot : null };
  }

  async function addPlayer() {
    setTried(true);
    if (playerNameError(name)) return;
    const ok = await run(() =>
      sb.from("match_players").insert({ match_id: match.id, user_id: null, name: name.trim(), ...target() }),
    );
    if (ok) {
      setName("");
      setTried(false);
      setSelected(null);
    }
  }

  async function joinMyself() {
    if (!uid) return;
    const ok = await run(() =>
      sb.from("match_players").insert({ match_id: match.id, user_id: uid, name: match.organizer_name, ...target() }),
    );
    if (ok) setSelected(null);
  }

  async function remove(p: Player) {
    setRemovingId(p.id);
    await run(() => sb.from("match_players").delete().eq("id", p.id));
    setRemovingId(null);
  }

  async function changeFormat(f: Format) {
    if (f === match.format) return;
    const affected = match.players.filter((p) => p.slot !== null && p.slot >= f);
    if (
      affected.length > 0 &&
      !window.confirm(
        `Al pasar a ${f} vs ${f}, ${affected.map((p) => p.name).join(", ")} ${affected.length === 1 ? "pasa" : "pasan"} al banco (o a un lugar libre). ¿Seguimos?`,
      )
    ) {
      return;
    }
    setSelected(null);
    await run(() => sb.rpc("update_match", { ...details(), p_format: f }));
  }

  /** Mover cualquier ficha (la RPC valida que seas admin y que quede en su mitad). */
  async function moveToken(ref: SlotRef, point: Point): Promise<boolean> {
    setError(null);
    const { error: err } = await sb.rpc("move_token", {
      p_match_id: match.id,
      p_team: ref.team,
      p_slot: ref.slot,
      p_x: point.x,
      p_y: point.y,
    });
    if (err) setError(errorMessage(err));
    return !err;
  }

  async function resetTeam(t: Team) {
    await run(() => sb.rpc("reset_team_layout", { p_match_id: match.id, p_team: t }));
  }

  const edit = useEditMatchDialog(match, async (f) => {
    const { error: err } = await sb.rpc("update_match", {
      ...details(),
      p_title: f.title,
      p_venue: f.venue,
      p_maps_url: f.mapsUrl,
      p_date: f.date,
      p_time: f.time,
      p_organizer_name: f.organizerName,
    });
    if (err) throw err;
    await reload();
  });

  // --- Textos ---------------------------------------------------------------
  const title = matchTitle(match.title, weekday(match.starts_at, match.timezone));
  const missing = missingCount(match);
  const roleOf = (ref: SlotRef) => ROLE_NAME[roles[ref.slot]];

  let hint = "Tocá un puesto libre en la cancha para elegir dónde juega, o agregalo y queda en el primer lugar libre.";
  if (current && !occupant) hint = `Va al puesto de ${roleOf(current)} en ${TEAM_LABEL[current.team]}.`;
  else if (current && occupant) hint = `Ahí ya juega ${occupant.name}. Va al primer lugar libre de ${TEAM_LABEL[current.team]}.`;
  if ((!current || occupant) && teamFull(targetTeam)) hint = `${TEAM_LABEL[targetTeam]} está completo: va al banco.`;
  const toBench = (!current || occupant) && teamFull(targetTeam);

  const myFooter = me ? (
    <p className="flex flex-wrap items-center gap-x-2 text-13 text-ink-2">
      Estás anotado como <strong className="font-semibold text-ink">{me.name}</strong>
      {me.slot !== null ? ` (${roleOf({ team: me.team, slot: me.slot })} en ${TEAM_LABEL[me.team]}).` : ` (banco de ${TEAM_LABEL[me.team]}).`}
      <button type="button" onClick={() => remove(me)} disabled={busy} className="h-11 font-semibold text-danger underline">
        Bajarme
      </button>
    </p>
  ) : (
    <Button variant="ghost" size="sm" onClick={joinMyself} disabled={!ready || busy}>
      ¿Jugás vos? Anotarme como {match.organizer_name}
    </Button>
  );

  const card = closed ? (
    <Card>
      <CardTitle>El partido ya empezó</CardTitle>
      <p className="text-14 leading-[1.45] text-ink-2">
        Las inscripciones están cerradas. Si se pasó para otro día, reprogramalo y se vuelven a abrir.
      </p>
      <Button size="md" onClick={edit.open}>
        Reprogramar
      </Button>
    </Card>
  ) : (
    <AddPlayerCard
      name={name}
      onName={(v) => {
        setName(v);
        setError(null);
      }}
      nameError={tried ? playerNameError(name) : null}
      team={targetTeam}
      onTeam={chooseTeam}
      hint={hint}
      error={error}
      submitLabel={!ready ? "Conectando…" : toBench ? "Agregar al banco" : "Agregar jugador"}
      busy={busy}
      disabled={!ready}
      onSubmit={addPlayer}
      footer={myFooter}
    />
  );

  return (
    <>
      <MatchLayout
        header={
          <MatchHeader
            eyebrow={closed ? "Partido cerrado" : "Panel del organizador"}
            title={title}
            when={formatMatchDate(match.starts_at, match.timezone)}
            venue={match.venue}
            mapsUrl={match.maps_url}
            organizer={match.organizer_name}
            action={
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={edit.open}
                  aria-label="Editar datos del partido"
                  className="flex h-11 items-center gap-2 rounded-btn border border-ink px-3 text-14 font-semibold text-ink lg:px-3.5"
                >
                  <EditIcon />
                  <span className="hidden lg:inline">Editar</span>
                </button>
                <ShareIconLink href={shareHref} />
              </div>
            }
          />
        }
        stat={
          <div className="flex flex-col gap-3">
            <SegmentedControl
              label="Formato del partido"
              value={match.format}
              onChange={changeFormat}
              disabled={!ready || busy}
              options={[
                { value: 5 as Format, label: "5 vs 5" },
                { value: 7 as Format, label: "7 vs 7" },
              ]}
            />
            <StatBox
              value={closed ? "—" : missing}
              title={closed ? "Las inscripciones cerraron" : missingLabel(missing)}
              subtitle={`${match.format} vs ${match.format} · ${match.format * 2} jugadores en cancha`}
            />
          </div>
        }
        pitch={
          <>
            <TeamBars onReset={resetTeam} disabled={!ready || busy} />
            <MatchPitch
              match={match}
              meId={me?.id}
              selected={current}
              // El organizador puede acomodar todas las fichas y elegir cualquier lugar.
              canDrag={() => true}
              canSelect={() => true}
              onSelect={select}
              onMove={moveToken}
            />
            <p className="text-13 leading-[1.45] text-ink-2 lg:flex lg:gap-5">
              <span>Arrastrá cualquier ficha dentro de la mitad de su equipo (o enfocala y usá las flechas). </span>
              <span>Tocá un puesto para elegirlo. </span>
              <span className="hidden lg:inline">Los que sobran van al banco.</span>
            </p>
            {error && closed && (
              <p role="alert" className="text-14 font-semibold text-danger">
                {error}
              </p>
            )}
          </>
        }
        card={card}
        rosters={<Rosters match={match} meId={me?.id} onRemove={closed ? undefined : remove} removingId={removingId} />}
        share={<ShareWideLink href={shareHref} />}
      />
      {edit.dialog}
    </>
  );
}

/**
 * Reemplaza las barras de formaciones del diseño: equipo, de qué lado juega y
 * "Restablecer posiciones" (vuelve a la disposición por defecto).
 */
function TeamBars({ onReset, disabled }: { onReset: (t: Team) => void; disabled?: boolean }) {
  const side = { A: { phone: "Abajo", desktop: "← Izquierda" }, B: { phone: "Arriba", desktop: "Derecha →" } };
  return (
    <ul className="flex flex-col gap-2 lg:h-13 lg:flex-row lg:items-center lg:justify-between">
      {(["B", "A"] as const).map((t) => (
        <li key={t} className={`flex items-center gap-2 ${t === "A" ? "lg:order-first" : ""}`}>
          <TeamSwatch team={t} />
          <span className="text-14 font-semibold lg:text-15">{TEAM_LABEL[t]}</span>
          <span className="text-13 text-ink-2">
            <span className="lg:hidden">{side[t].phone}</span>
            <span className="hidden lg:inline">{side[t].desktop}</span>
          </span>
          <button
            type="button"
            onClick={() => onReset(t)}
            disabled={disabled}
            aria-label={`Restablecer posiciones de ${TEAM_LABEL[t]}`}
            title={`Restablecer posiciones de ${TEAM_LABEL[t]}`}
            className="ml-auto flex size-11 items-center justify-center rounded-field text-ink-2 lg:ml-0"
          >
            <ResetIcon />
          </button>
        </li>
      ))}
    </ul>
  );
}
