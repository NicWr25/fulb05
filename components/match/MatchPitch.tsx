"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent, type PointerEvent } from "react";
import { Pitch, PitchSpot } from "@/components/pitch/Pitch";
import { PlayerToken } from "@/components/pitch/PlayerToken";
import { ShirtRow } from "@/components/pitch/ShirtRow";
import { entryBumps, type EntryBump } from "@/lib/domain/entry";
import { playerDisplayName, slotsByTeam, type Match, type Player } from "@/lib/domain/match";
import type { SwapMove } from "@/lib/domain/swaps";
import {
  clampPercent,
  clampToHalf,
  fromScreen,
  initials,
  resolveLayout,
  toScreen,
  type Layout,
  type Orientation,
  type Point,
} from "@/lib/domain/positions";
import { TEAMS, TEAM_IN, type Team } from "@/lib/domain/teams";

export type SlotRef = { team: Team; slot: number };

/** Cuántos px hay que mover el puntero para que cuente como arrastre (y no como toque). */
const DRAG_THRESHOLD_PX = 4;
/** Paso de las flechas del teclado, en % de la cancha. */
const KEY_STEP = 2;
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function reducedMotionSnapshot() {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

type Drag = { ref: SlotRef; startX: number; startY: number; moved: boolean; point: Point };

/** La cancha se dibuja parada en celular y acostada desde lg (misma regla que el CSS). */
function currentOrientation(): Orientation {
  return window.matchMedia("(min-width: 64rem)").matches ? "horizontal" : "vertical";
}

/**
 * La cancha con las fichas de un partido. La usan la vista de jugador y el
 * panel del organizador, con reglas distintas:
 *   - canDrag(ref, player): ¿se puede arrastrar esa ficha? (jugador: solo la
 *     propia; organizador: todas).
 *   - canSelect(ref, player): ¿se puede seleccionar esa ficha? (organizador:
 *     para administrarla o intercambiarla).
 *
 * Arrastrar:
 *   - La ficha "frena" en la línea del medio (clampToHalf): cada equipo se
 *     acomoda en su mitad. Mientras se arrastra, la mitad rival se sombrea.
 *   - Al soltar se guarda con onMove (RPC move_token, que vuelve a validar
 *     todo en la base).
 *   - Alternativa sin arrastre (WCAG 2.5.7): con la ficha enfocada, las
 *     flechas la mueven de a 2%.
 * Una ficha que no se puede arrastrar ni elegir se dibuja estática (no es botón).
 */
export function MatchPitch({
  match,
  meId,
  selected,
  canDrag = () => false,
  canSelect = () => false,
  onSelect,
  onClearSelection,
  onMove,
  disabled,
  arrivingIds = [],
  swapMoves = [],
}: {
  match: Pick<Match, "format" | "players" | "layout">;
  meId?: string | null;
  selected?: SlotRef | null;
  canDrag?: (ref: SlotRef, player: Player) => boolean;
  canSelect?: (ref: SlotRef, player: Player) => boolean;
  onSelect?: (ref: SlotRef) => void;
  onClearSelection?: () => void;
  /** Guarda la nueva posición; devuelve false si falló (la ficha vuelve a su lugar). */
  onMove?: (ref: SlotRef, point: Point) => Promise<boolean>;
  disabled?: boolean;
  arrivingIds?: readonly string[];
  swapMoves?: readonly SwapMove[];
}) {
  const pitchRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useSyncExternalStore(subscribeReducedMotion, reducedMotionSnapshot, () => false);
  const [drag, setDrag] = useState<Drag | null>(null);
  // Posición ya soltada pero todavía no confirmada por la base: evita que la
  // ficha "vuelva" a su lugar viejo mientras viaja el pedido.
  const [pending, setPending] = useState<{ ref: SlotRef; point: Point } | null>(null);

  useEffect(() => {
    if (!selected || !onClearSelection) return;
    const dismiss = (event: MouseEvent) => {
      if (event.target instanceof Element && event.target.closest("[data-pitch-selectable], [data-selection-context]")) return;
      onClearSelection();
    };
    const escape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") onClearSelection();
    };
    document.addEventListener("click", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("click", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, [selected, onClearSelection]);

  // Cuando llega un layout nuevo (el nuestro ya guardado, o un cambio de otro
  // por Realtime), manda ese y se descarta el pendiente.
  const [prevLayout, setPrevLayout] = useState(match.layout);
  if (match.layout !== prevLayout) {
    setPrevLayout(match.layout);
    setPending(null);
  }

  const layout: Layout = resolveLayout(match.format, match.layout);
  const slots = slotsByTeam(match);
  const swapById = new Map(reducedMotion ? [] : swapMoves.map((move) => [move.id, move.from] as const));
  const arriving = new Set(reducedMotion ? [] : arrivingIds.filter((id) => !swapById.has(id)));
  const bumped = new Map<string, EntryBump>();
  const bends = new Map<string, Point>();
  for (const id of arriving) {
    const newcomer = match.players.find((player) => player.id === id);
    if (!newcomer) continue;
    const impacts = entryBumps(match, newcomer);
    const destination = layout[newcomer.team][newcomer.slot];
    bends.set(id, {
      x: 50 + (destination.x - 50) * 0.55,
      y: 50 + (destination.y - 50) * 0.55 - Math.sign(impacts[0]?.y ?? 0) * 6,
    });
    for (const bump of impacts) {
      if (!arriving.has(bump.id) && !swapById.has(bump.id)) bumped.set(bump.id, bump);
    }
  }
  const same = (a: SlotRef | null | undefined, b: SlotRef) => a?.team === b.team && a.slot === b.slot;

  function pointOf(ref: SlotRef): Point {
    if (drag?.moved && same(drag.ref, ref)) return drag.point;
    if (pending && same(pending.ref, ref)) return pending.point;
    return layout[ref.team][ref.slot];
  }

  function commit(ref: SlotRef, point: Point) {
    if (!onMove) return;
    const p = clampToHalf(ref.team, point);
    const rounded = { x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10 };
    setPending({ ref, point: rounded });
    void onMove(ref, rounded).then((ok) => {
      if (!ok) setPending(null);
    });
  }

  function pointFromEvent(e: PointerEvent, team: Team): Point | null {
    const rect = pitchRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const left = clampPercent(((e.clientX - rect.left) / rect.width) * 100);
    const top = clampPercent(((e.clientY - rect.top) / rect.height) * 100);
    return clampToHalf(team, fromScreen(left, top, currentOrientation()));
  }

  function onPointerDown(ref: SlotRef, e: PointerEvent<HTMLButtonElement>) {
    if (e.button !== 0 || disabled) return;
    // "Captura" el puntero: los move/up siguientes llegan a esta ficha aunque
    // el dedo se salga de ella.
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ ref, startX: e.clientX, startY: e.clientY, moved: false, point: pointOf(ref) });
  }

  function onPointerMove(e: PointerEvent<HTMLButtonElement>) {
    if (!drag) return;
    const dist = Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY);
    if (!drag.moved && dist < DRAG_THRESHOLD_PX) return;
    const point = pointFromEvent(e, drag.ref.team);
    if (point) setDrag({ ...drag, moved: true, point });
  }

  function onPointerUp(player: Player) {
    if (!drag) return;
    if (drag.moved) commit(drag.ref, drag.point);
    else if (canSelect(drag.ref, player)) onSelect?.(drag.ref); // fue un toque
    setDrag(null);
  }

  function onKeyDown(ref: SlotRef, e: KeyboardEvent<HTMLButtonElement>) {
    const deltas: Record<string, [number, number]> = {
      ArrowLeft: [-KEY_STEP, 0],
      ArrowRight: [KEY_STEP, 0],
      ArrowUp: [0, -KEY_STEP],
      ArrowDown: [0, KEY_STEP],
    };
    const d = deltas[e.key];
    if (!d) return; // Enter/Espacio disparan onClick
    e.preventDefault();
    const o = currentOrientation();
    const { left, top } = toScreen(pointOf(ref), o);
    commit(ref, fromScreen(clampPercent(left + d[0]), clampPercent(top + d[1]), o));
  }

  const dragging = drag?.moved ? drag.ref : null;

  return (
    <>
      <ShirtRow match={match} team="B" />
      <Pitch ref={pitchRef}>
        {dragging && <div className="pitch-shade" data-team={dragging.team} aria-hidden="true" />}
        {TEAMS.flatMap((team) =>
          layout[team].map((_, slot) => {
            const ref = { team, slot };
            const player = slots[team][slot];
            if (!player) return null;
            const mine = Boolean(meId && player.id === meId);
            const draggable = canDrag(ref, player);
            const selectable = canSelect(ref, player);
            const isSelected = same(selected, ref);
            const isDragging = same(dragging, ref);
            const displayName = playerDisplayName(player, match.players);
            const who = `${mine ? "Vos" : displayName} en ${TEAM_IN[team]}${player.alias ? `, nombre real: ${player.name}` : ""}`;
            const label = draggable ? `${who}. Arrastrá o usá las flechas para moverla en tu mitad.` : who;
            const entering = arriving.has(player.id);
            const bump = bumped.get(player.id);
            const swapFrom = swapById.get(player.id);

            return (
              <PitchSpot key={player.id} point={pointOf(ref)} arriving={entering}
                bend={bends.get(player.id)} bump={bump} swapFrom={swapFrom}
                z={entering || swapFrom || isDragging ? 20 : isSelected || mine ? 10 : 1}>
                <PlayerToken
                  team={team}
                  playerName={displayName}
                  tagAboveMobile={pointOf(ref).x <= 10}
                  text={initials(player.alias || player.name)}
                  mine={mine}
                  selected={isSelected}
                  dragging={isDragging}
                  draggable={draggable}
                  static={!draggable && !selectable}
                  disabled={disabled || entering || Boolean(bump) || Boolean(swapFrom)}
                  aria-label={label}
                  data-pitch-selectable={selectable ? "" : undefined}
                  {...(draggable
                    ? {
                        onPointerDown: (e: PointerEvent<HTMLButtonElement>) => onPointerDown(ref, e),
                        onPointerMove,
                        onPointerUp: () => onPointerUp(player),
                        onPointerCancel: () => setDrag(null),
                        onKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => onKeyDown(ref, e),
                        // Con mouse/dedo la selección la maneja onPointerUp; acá
                        // solo llegan los "clicks" de teclado (detail === 0).
                        onClick: (e: React.MouseEvent) => {
                          if (e.detail === 0 && selectable) onSelect?.(ref);
                        },
                      }
                    : { onClick: () => onSelect?.(ref) })}
                />
              </PitchSpot>
            );
          }),
        )}
      </Pitch>
      <ShirtRow match={match} team="A" />
    </>
  );
}
