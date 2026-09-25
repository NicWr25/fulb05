import { describe, expect, it } from "vitest";
import { defaultLayout } from "@/lib/domain/positions";
import { detectSwap } from "@/lib/domain/swaps";

const ana = { id: "ana", name: "Ana", team: "A" as const, slot: 0 };
const bruno = { id: "bruno", name: "Bruno", team: "B" as const, slot: 3 };

describe("animación de intercambio", () => {
  it("usa las posiciones anteriores de los dos jugadores", () => {
    const layout = defaultLayout(5);
    const before = { format: 5 as const, layout, players: [ana, bruno] };
    const after = { ...before, players: [
      { ...ana, team: "B" as const, slot: 3 },
      { ...bruno, team: "A" as const, slot: 0 },
    ] };
    expect(detectSwap(before, after)).toEqual([
      { id: "ana", from: layout.A[0] },
      { id: "bruno", from: layout.B[3] },
    ]);
  });

  it("no confunde un cambio individual ni un alta con un intercambio", () => {
    const before = { format: 5 as const, layout: defaultLayout(5), players: [ana, bruno] };
    expect(detectSwap(before, { ...before, players: [{ ...ana, team: "B" as const, slot: 1 }, bruno] }))
      .toEqual([]);
    expect(detectSwap(before, { ...before, players: [...before.players, { id: "caro", name: "Caro", team: "A", slot: 1 }] }))
      .toEqual([]);
  });
});
