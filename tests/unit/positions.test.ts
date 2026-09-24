import { describe, expect, it } from "vitest";
import {
  defaultLayout,
  defaultTeamLayout,
  fromScreen,
  initials,
  resolveLayout,
  slotRoles,
  toScreen,
} from "@/lib/domain/positions";

describe("slotRoles", () => {
  it("fútbol 5 = ARQ + 2 DEF + 2 DEL", () => {
    expect(slotRoles(5)).toEqual(["ARQ", "DEF", "DEF", "DEL", "DEL"]);
  });

  it("fútbol 7 = ARQ + 3 DEF + 2 MED + 1 DEL", () => {
    expect(slotRoles(7)).toEqual(["ARQ", "DEF", "DEF", "DEF", "MED", "MED", "DEL"]);
  });
});

describe("defaultTeamLayout", () => {
  it("devuelve un punto por lugar", () => {
    expect(defaultTeamLayout(5, "A")).toHaveLength(5);
    expect(defaultTeamLayout(7, "B")).toHaveLength(7);
  });

  it("pone al arquero de Claros junto a su arco (x chico) y centrado", () => {
    expect(defaultTeamLayout(7, "A")[0]).toEqual({ x: 5.5, y: 50 });
  });

  it("Oscuros es el espejo de Claros a lo largo de la cancha", () => {
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

  it("vertical (celular): el arco de Claros (x = 0) queda abajo", () => {
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
