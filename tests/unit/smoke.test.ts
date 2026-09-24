import { describe, expect, it } from "vitest";

// Test de humo: confirma que Vitest y el alias "@/..." están bien configurados.
// Se reemplaza por tests reales de lib/domain en la etapa (c).
describe("vitest", () => {
  it("corre", () => {
    expect(1 + 1).toBe(2);
  });
});
