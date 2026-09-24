"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { StatBox } from "@/components/ui/StatBox";
import { EditIcon } from "@/components/ui/icons";
import { QuickAddBar } from "./QuickAddBar";
import { useEditMatchDialog } from "./EditMatchDialog";
import { MatchHeader } from "./MatchHeader";
import { MatchLayout } from "./MatchLayout";
import { MatchPitch, type SlotRef } from "./MatchPitch";
import { ShareIconLink, ShareWideLink } from "./ShareButtons";
import { supabaseBrowser } from "@/lib/supabase/browser";
import type { MatchState } from "@/lib/hooks/useMatch";
import { formatMatchDate, toLocalInputs } from "@/lib/domain/datetime";
import { errorMessage } from "@/lib/domain/errors";
import { missingCount, missingLabel, slotsByTeam, type Player } from "@/lib/domain/match";
import { type Point } from "@/lib/domain/positions";
import { matchTitle } from "@/lib/domain/share";
import { TEAM_IN, TEAM_LABEL, type Format, type Team } from "@/lib/domain/teams";
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
  const { match, me, status, reload } = state;
  const [selected, setSelected] = useState<SlotRef | null>(null);
  const [name, setName] = useState("");
  const [team, setTeam] = useState<Team>("A");
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [moving, setMoving] = useState<Player | null>(null);

  const sb = supabaseBrowser();
  const slots = slotsByTeam(match);
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
      p_venue: match.venue ?? "",
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
    if (moving) {
      if (slots[ref.team][ref.slot]) return;
      void movePlayer(moving, ref);
      return;
    }
    setSelected(same ? null : ref);
    setTeam(ref.team);
  }

  function chooseTeam(t: Team) {
    setTeam(t);
    if (current && current.team !== t) setSelected(null);
  }

  /** Destino de un alta: el lugar elegido si está libre; si no, primer libre. */
  function target() {
    return { team: targetTeam, slot: current && !occupant ? current.slot : null as unknown as number };
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

  async function remove(p: Player) {
    if (p.id === me?.id || !window.confirm(`¿Sacar a ${p.name} del partido?`)) return;
    const ok = await run(() => sb.from("match_players").delete().eq("id", p.id));
    if (ok) setSelected(null);
  }

  async function movePlayer(p: Player, ref: SlotRef) {
    const ok = await run(() => sb.rpc("move_player_slot", {
      p_match_id: match.id, p_player_id: p.id, p_team: ref.team, p_slot: ref.slot,
    }));
    if (ok) { setMoving(null); setSelected(null); }
  }

  async function changeFormat(f: Format) {
    if (f === match.format) return;
    setSelected(null);
    await run(() => sb.rpc("update_match", { ...details(), p_format: f }));
  }

  /** El organizador puede acomodar cualquier ficha ocupada; la RPC valida hora y mitad. */
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
  const title = matchTitle(match.title, match.organizer_name);
  const missing = missingCount(match);

  let hint = "Sin lugar elegido: primer lugar libre del equipo.";
  if (current && !occupant) hint = `Va al lugar ${current.slot + 1} en ${TEAM_IN[current.team]}.`;
  else if (current && occupant) hint = `Ahí ya juega ${occupant.name}. Tocá su ficha para moverlo o sacarlo.`;
  if ((!current || occupant) && teamFull(targetTeam)) hint = `${TEAM_IN[targetTeam][0].toUpperCase() + TEAM_IN[targetTeam].slice(1)} está completo.`;

  const card = closed ? (
    <Card>
      <CardTitle>El partido ya empezó</CardTitle>
      <p className="text-14 leading-[1.45] text-ink-2">
        Las inscripciones están cerradas. Si se pasó para otro día, reprogramalo y se vuelven a abrir.
      </p>
      <Button size="md" onClick={edit.open}>Reprogramar</Button>
    </Card>
  ) : null;

  const quickAdd = !closed && (
    <QuickAddBar
      name={name}
      onName={(value) => { setName(value); setError(null); }}
      nameError={tried ? playerNameError(name) : null}
      team={targetTeam}
      onTeam={chooseTeam}
      hint={hint}
      error={error}
      placeholder="Nombre del jugador"
      submitLabel={!ready ? "Conectando…" : "+ Agregar"}
      busy={busy}
      disabled={!ready || Boolean((!current || occupant) && teamFull(targetTeam))}
      onSubmit={addPlayer}
    />
  );

  return (
    <>
      <MatchLayout
        header={
          <MatchHeader
            eyebrow={closed ? "Partido cerrado" : "Panel del organizador"}
            title={title}
            onRenameTitle={async (newTitle) => {
              const { error: err } = await sb.rpc("update_match", { ...details(), p_title: newTitle });
              if (err) throw err;
              await reload();
            }}
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
                  className="flex h-11 min-w-11 items-center justify-center gap-2 rounded-btn border border-ink px-3 text-14 font-semibold text-ink lg:px-3.5"
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
            {quickAdd}
            {current && occupant && !closed && <div className="flex flex-wrap items-center gap-2 rounded-panel border border-line bg-surface p-2.5 text-13">
              <span className="min-w-0 flex-1 font-semibold">{occupant.name}</span>
              <button type="button" onClick={() => { setMoving(occupant); setSelected(null); }} className="min-h-11 rounded-btn border border-line-strong px-3 font-semibold">Cambiar lugar</button>
              {occupant.id !== me?.id && <button type="button" onClick={() => remove(occupant)} disabled={busy} className="min-h-11 rounded-btn border border-line-strong px-3 font-semibold text-danger">Sacar</button>}
            </div>}
            {moving && <div className="flex items-center gap-2 rounded-panel border border-line bg-surface p-2.5 text-13">
              <p className="flex-1">Tocá un lugar libre para mover a {moving.name}.</p>
              <button type="button" onClick={() => setMoving(null)} className="min-h-11 px-2 font-semibold">Cancelar</button>
            </div>}
            <details className="text-13 text-ink-2"><summary className="min-h-11 cursor-pointer font-semibold">Restablecer posiciones</summary>
              <div className="flex gap-2">{(["A", "B"] as const).map((t) => <button key={t} type="button" onClick={() => resetTeam(t)} disabled={!ready || busy} className="min-h-11 rounded-btn border border-line-strong px-3">{TEAM_LABEL[t]}</button>)}</div>
            </details>
            <MatchPitch
              match={match}
              meId={me?.id}
              selected={current}
              canDrag={(_, player) => !closed && Boolean(player)}
              canSelect={() => !closed}
              onSelect={select}
              onMove={moveToken}
            />
            <p className="text-13 leading-[1.45] text-ink-2 lg:flex lg:gap-5">
              <span>Arrastrá cualquier ficha dentro de su mitad. Tocá una ficha para moverla o sacarla.</span>
            </p>
            {error && closed && (
              <p role="alert" className="text-14 font-semibold text-danger">
                {error}
              </p>
            )}
          </>
        }
        card={card}
        share={<ShareWideLink href={shareHref} />}
      />
      {edit.dialog}
    </>
  );
}
