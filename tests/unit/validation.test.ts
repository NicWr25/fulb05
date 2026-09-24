import { describe, expect, it } from "vitest";
import {
  isValidMapsUrl,
  normalizeMapsUrl,
  venueFromMapsUrl,
  playerNameError,
  validateMatchInput,
  type CreateMatchInput,
} from "@/lib/domain/validation";

const NOW = new Date("2026-09-24T12:00:00");
const OK: CreateMatchInput = {
  format: 5,
  title: "",
  date: "2026-09-26",
  time: "21:00",
  venue: "Cancha Parque",
  mapsUrl: "https://maps.app.goo.gl/abc",
  organizerName: "Nico",
};

describe("validateMatchInput", () => {
  it("acepta un partido válido (título y cancha opcionales)", () => {
    expect(validateMatchInput(OK, NOW)).toEqual({});
  });

  it("pide día, hora, Maps y nombre", () => {
    const e = validateMatchInput({ ...OK, date: "", time: "", mapsUrl: "  ", organizerName: "" }, NOW);
    expect(Object.keys(e).sort()).toEqual(["date", "mapsUrl", "organizerName", "time"]);
  });

  it("rechaza fechas pasadas o a más de un año", () => {
    expect(validateMatchInput({ ...OK, date: "2026-09-23" }, NOW).date).toMatch(/futura/);
    expect(validateMatchInput({ ...OK, date: "2027-12-01" }, NOW).date).toMatch(/un año/);
  });

  it("respeta los largos máximos de la base", () => {
    expect(validateMatchInput({ ...OK, venue: "x".repeat(81) }, NOW).venue).toBeDefined();
    expect(validateMatchInput({ ...OK, title: "x".repeat(61) }, NOW).title).toBeDefined();
    expect(validateMatchInput({ ...OK, organizerName: "x".repeat(25) }, NOW).organizerName).toBeDefined();
  });
});

describe("enlaces de Google Maps", () => {
  it("normaliza: agrega https y pasa http a https", () => {
    expect(normalizeMapsUrl("maps.app.goo.gl/abc")).toBe("https://maps.app.goo.gl/abc");
    expect(normalizeMapsUrl("http://maps.google.com/?q=x")).toBe("https://maps.google.com/?q=x");
    expect(normalizeMapsUrl("  ")).toBe("");
  });

  it.each([
    ["https://maps.app.goo.gl/AbC123", true],
    ["https://goo.gl/maps/xyz", true],
    ["https://www.google.com/maps/place/Cancha", true],
    ["https://www.google.com.uy/maps/@-34.9,-56.1,15z", true],
    ["https://maps.google.com/?q=cancha", true],
    ["javascript:alert(1)", false],
    ["https://evil.example/maps", false],
    ["https://maps.app.goo.gl.evil.com/x", false],
  ])("%s -> %s", (url, ok) => {
    expect(isValidMapsUrl(url)).toBe(ok);
  });
});

it("extrae el nombre de enlaces largos y deja los cortos sin nombre", () => {
  expect(venueFromMapsUrl("https://www.google.com/maps/place/Cancha+Parque/@-34,56")).toBe("Cancha Parque");
  expect(venueFromMapsUrl("https://maps.app.goo.gl/abc")).toBeNull();
});

describe("playerNameError", () => {
  it("acepta nombres normales y rechaza vacíos, largos o con saltos de línea", () => {
    expect(playerNameError("Nico")).toBeNull();
    expect(playerNameError("   ")).not.toBeNull();
    expect(playerNameError("x".repeat(25))).not.toBeNull();
    expect(playerNameError("Ni\nco")).not.toBeNull();
  });
});
