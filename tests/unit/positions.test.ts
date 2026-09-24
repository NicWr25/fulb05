import { describe, expect, it } from "vitest";
import {
  clampToHalf,
  defaultLayout,
  defaultTeamLayout,
  fromScreen,
  inOwnHalf,
  initials,
  resolveLayout,
  toScreen,
} from "@/lib/domain/positions";

describe("defaultTeamLayout", () => {
  it("devuelve un punto por lugar", () => {
    expect(defaultTeamLayout(5, "A")).toHaveLength(5);
    expect(defaultTeamLayout(7, "B")).toHaveLength(7);
  });

  it("pone al arquero de Blanco junto a su arco (x chico) y centrado", () => {
    expect(defaultTeamLayout(7, "A")[0]).toEqual({ x: 5.5, y: 50 });
  });

  it("Negro es el espejo de Blanco a lo largo de la cancha", () => {
    const a = defaultTeamLayout(7, "A");
    const b = defaultTeamLayout(7, "B");
    b.forEach((p, i) => {
      expect(p.x).toBeCloseTo(100 - a[i].x);
      expect(p.y).toBeCloseTo(a[i].y);
    });
  });

  it("cada equipo se queda en su mitad", () => {
    const { A, B } = defaultLayout(7);
    expect(Math.max(...A.map((p) => p.x))).toBeLessThan(50);
    expect(Math.min(...B.map((p) => p.x))).toBeGreaterThan(50);
  });

  it("todas las coordenadas quedan dentro de la cancha", () => {
    for (const format of [5, 7] as const) {
      const { A, B } = defaultLayout(format);
      for (const p of [...A, ...B]) {
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(100);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeLessThanOrEqual(100);
      }
    }
  });
});

describe("resolveLayout", () => {
  it("usa el layout guardado si coincide con el formato", () => {
    const saved = defaultLayout(5);
    saved.A[1] = { x: 30, y: 30 };
    expect(resolveLayout(5, saved)).toBe(saved);
  });

  it("vuelve al de por defecto si no hay layout o no coincide con el formato", () => {
    expect(resolveLayout(7, null)).toEqual(defaultLayout(7));
    expect(resolveLayout(7, defaultLayout(5))).toEqual(defaultLayout(7));
  });
});

describe("toScreen / fromScreen", () => {
  it("horizontal (escritorio): coordenadas canónicas tal cual", () => {
    expect(toScreen({ x: 10, y: 20 }, "horizontal")).toEqual({ left: 10, top: 20 });
  });

  it("vertical (celular): el arco de Blanco (x = 0) queda abajo", () => {
    expect(toScreen({ x: 0, y: 50 }, "vertical")).toEqual({ left: 50, top: 100 });
    expect(toScreen({ x: 100, y: 50 }, "vertical")).toEqual({ left: 50, top: 0 });
  });

  it("fromScreen es la inversa de toScreen en ambas orientaciones", () => {
    const p = { x: 23.5, y: 71 };
    for (const o of ["vertical", "horizontal"] as const) {
      const { left, top } = toScreen(p, o);
      expect(fromScreen(left, top, o)).toEqual(p);
    }
  });
});

describe("initials", () => {
  it.each([
    ["Nico", "NI"],
    ["juan pérez", "JP"],
    ["  Ana  María López ", "AL"],
    ["Ñ", "Ñ"],
    ["", ""],
  ])("%j -> %j", (name, expected) => {
    expect(initials(name)).toBe(expected);
  });
});

describe("mitades de la cancha", () => {
  it("Blanco juegan en x ≤ 50 y Negro en x ≥ 50 (la línea del medio vale para los dos)", () => {
    expect(inOwnHalf("A", { x: 50, y: 10 })).toBe(true);
    expect(inOwnHalf("A", { x: 50.1, y: 10 })).toBe(false);
    expect(inOwnHalf("B", { x: 50, y: 10 })).toBe(true);
    expect(inOwnHalf("B", { x: 49.9, y: 10 })).toBe(false);
  });

  it("clampToHalf frena la ficha en la línea del medio", () => {
    expect(clampToHalf("A", { x: 80, y: 40 })).toEqual({ x: 50, y: 40 });
    expect(clampToHalf("B", { x: 10, y: 40 })).toEqual({ x: 50, y: 40 });
  });

  it("clampToHalf también la mantiene dentro de la cancha", () => {
    expect(clampToHalf("A", { x: -5, y: 120 })).toEqual({ x: 3, y: 97 });
    expect(clampToHalf("B", { x: 130, y: -1 })).toEqual({ x: 97, y: 3 });
  });

  it("la disposición por defecto respeta las mitades", () => {
    for (const format of [5, 7] as const) {
      const { A, B } = defaultLayout(format);
      expect(A.every((p) => inOwnHalf("A", p))).toBe(true);
      expect(B.every((p) => inOwnHalf("B", p))).toBe(true);
    }
  });
});

describe("paridad con SQL", () => {
  // Mismos valores que devuelve private.default_layout(7) en la base
  // (supabase/migrations/..._player_positions.sql). Si cambiás el algoritmo
  // en un lado, este test te recuerda cambiarlo en el otro.
  it("defaultTeamLayout(7, 'A') coincide con private.default_team_layout(7, 'A')", () => {
    expect(defaultTeamLayout(7, "A")).toEqual([
      { x: 5.5, y: 50 },
      { x: 17, y: 26.67 },
      { x: 17, y: 50 },
      { x: 17, y: 73.33 },
      { x: 29.5, y: 32.5 },
      { x: 29.5, y: 67.5 },
      { x: 42, y: 50 },
    ]);
  });
});
