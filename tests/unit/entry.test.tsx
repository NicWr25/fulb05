import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MatchPitch } from "@/components/match/MatchPitch";
import { ShirtRow } from "@/components/pitch/ShirtRow";
import { entryBumps, entryDestination } from "@/lib/domain/entry";
import { defaultLayout } from "@/lib/domain/positions";

const ana = { id: "ana", name: "Ana", team: "A" as const, slot: 0 };
const bruno = { id: "bruno", name: "Bruno", team: "B" as const, slot: 0 };

describe("entrada de fichas", () => {
  it("calcula destinos estables en la mitad elegida y se desvía al chocar", () => {
    const layout = defaultLayout(5);
    layout.A[0] = { x: 35, y: 50 };
    const match = { format: 5 as const, layout, players: [ana] };
    const first = entryDestination(match, "A");
    expect(entryDestination(match, "A")).toEqual(first);
    expect(first.x).toBeLessThan(50);
    expect(first.y).not.toBe(50);
    expect(entryDestination(match, "B").x).toBeGreaterThan(50);
  });

  it("desplaza visualmente a las fichas cercanas al recorrido", () => {
    const layout = defaultLayout(5);
    layout.B[0] = { x: 78, y: 50 };
    layout.B[1] = { x: 65, y: 50 };
    layout.A[0] = { x: 18, y: 15 };
    const newcomer = { ...bruno, slot: 0 };
    const match = {
      format: 5 as const, layout,
      players: [ana, newcomer, { id: "caro", name: "Caro", team: "B" as const, slot: 1 }],
    };
    expect(entryBumps(match, newcomer).map((bump) => bump.id)).toEqual(["caro"]);
  });

  it("deja espacio entre dos fichas nuevas del mismo equipo", () => {
    const layout = defaultLayout(5);
    const first = entryDestination({ format: 5, layout, players: [] }, "A");
    layout.A[0] = first;
    const second = entryDestination({ format: 5, layout, players: [ana] }, "A");
    expect(Math.hypot((first.x - second.x) * 1.05, (first.y - second.y) * 0.68))
      .toBeGreaterThanOrEqual(12);
  });

  it("muestra una remera por lugar y ninguna ficha vacía dentro de la cancha", () => {
    const match = { format: 5 as const, layout: defaultLayout(5), players: [ana] };
    const shirts = renderToStaticMarkup(<ShirtRow match={match} team="A" />);
    expect(shirts).toContain("Blanco: 1 de 5 jugadores");
    expect(shirts.match(/<svg /g)).toHaveLength(5);
    const pitch = renderToStaticMarkup(<MatchPitch match={match} />);
    expect(pitch.match(/class="pitch-spot"/g)).toHaveLength(1);
    expect(pitch).not.toContain("Lugar 2 libre");
  });
});
