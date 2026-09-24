"use client";

import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { Pitch, PitchSpot } from "@/components/pitch/Pitch";
import { PlayerToken } from "@/components/pitch/PlayerToken";
import { slotsByTeam, type Match, type Player } from "@/lib/domain/match";
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
 *   - canSelect(ref, player): ¿se puede elegir ese lugar? (jugador: libres;
 *     organizador: todos).
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
  onMove,
  disabled,
}: {
  match: Pick<Match, "format" | "players" | "layout">;
  meId?: string | null;
  selected?: SlotRef | null;
  canDrag?: (ref: SlotRef, player: Player | null) => boolean;
  canSelect?: (ref: SlotRef, player: Player | null) => boolean;
  onSelect?: (ref: SlotRef) => void;
  /** Guarda la nueva posición; devuelve false si falló (la ficha vuelve a su lugar). */
  onMove?: (ref: SlotRef, point: Point) => Promise<boolean>;
  disabled?: boolean;
}) {
  const pitchRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  // Posición ya soltada pero todavía no confirmada por la base: evita que la
  // ficha "vuelva" a su lugar viejo mientras viaja el pedido.
  const [pending, setPending] = useState<{ ref: SlotRef; point: Point } | null>(null);

  // Cuando llega un layout nuevo (el nuestro ya guardado, o un cambio de otro
  // por Realtime), manda ese y se descarta el pendiente.
  const [prevLayout, setPrevLayout] = useState(match.layout);
  if (match.layout !== prevLayout) {
    setPrevLayout(match.layout);
    setPending(null);
  }

  const layout: Layout = resolveLayout(match.format, match.layout);
  const slots = slotsByTeam(match);
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

  function onPointerUp(player: Player | null) {
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
    <Pitch ref={pitchRef}>
      {dragging && <div className="pitch-shade" data-team={dragging.team} aria-hidden="true" />}
      {TEAMS.flatMap((team) =>
        layout[team].map((_, slot) => {
          const ref = { team, slot };
          const player = slots[team][slot];
          const mine = Boolean(player && meId && player.id === meId);
          const draggable = canDrag(ref, player);
          const selectable = canSelect(ref, player);
          const isSelected = same(selected, ref);
          const isDragging = same(dragging, ref);
          const who = player ? `${mine ? "Vos" : player.name} en ${TEAM_IN[team]}` : `Lugar ${slot + 1} libre en ${TEAM_IN[team]}`;
          const label = draggable ? `${who}. Arrastrá o usá las flechas para moverla en tu mitad.` : who;

          return (
            <PitchSpot key={team + slot} point={pointOf(ref)} z={isDragging ? 20 : isSelected || mine ? 10 : 1}>
              <PlayerToken
                team={team}
                playerName={player?.name}
                text={player ? initials(player.name) : String(slot + 1)}
                mine={mine}
                selected={isSelected}
                dragging={isDragging}
                draggable={draggable}
                static={!draggable && !selectable}
                disabled={disabled}
                aria-label={label}
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
  );
}
