import { describe, expect, it } from "vitest";
import { ogDescription, ogImageData, ogTitle } from "@/lib/domain/og";
import type { Match } from "@/lib/domain/match";

// Jueves 1/10/2026 21:00 en Montevideo = viernes 00:00 UTC.
const match: Match = {
  id: "abcdefgh",
  format: 5,
  title: null,
  venue: "Cancha X",
  maps_url: null,
  starts_at: "2026-10-02T00:00:00Z",
  timezone: "America/Montevideo",
  organizer_name: "Nico",
  layout: null,
  players: [
    { id: "1", name: "A", team: "A", slot: 0 },
    { id: "2", name: "B", team: "B", slot: 1 },
    { id: "3", name: "C", team: "B", slot: null },
  ],
};

describe("Open Graph", () => {
  it("título con el formato del spec, en la hora de la cancha (no en UTC)", () => {
    expect(ogTitle(match)).toBe("Fútbol 5 · Jueves 21:00 · Cancha X");
  });

  it("descripción: faltan N (el banco no cuenta) y quién organiza", () => {
    expect(ogDescription(match)).toBe("Faltan 8 jugadores · Organiza Nico. ¡Anotate!");
    expect(ogDescription({ ...match, title: "Fulbito" })).toBe("Fulbito · Faltan 8 jugadores · Organiza Nico. ¡Anotate!");
  });

  it("descripción de un partido cerrado", () => {
    expect(ogDescription(match, { closed: true })).toBe("Inscripciones cerradas · Organiza Nico.");
  });

  it("datos de la imagen: titulares por equipo", () => {
    const d = ogImageData(match);
    expect(d).toMatchObject({ title: "Partido del jueves", claros: 1, oscuros: 1, missing: 8 });
  });
});
