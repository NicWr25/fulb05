import { describe, expect, it } from "vitest";
import { TEAM_IN, TEAM_LABEL } from "@/lib/domain/teams";

describe("nombres de equipos", () => {
  it("usa etiquetas cortas y frases naturales", () => {
    expect(TEAM_LABEL).toEqual({ A: "Blanco", B: "Negro" });
    expect(TEAM_IN).toEqual({ A: "el equipo blanco", B: "el equipo negro" });
  });
});
