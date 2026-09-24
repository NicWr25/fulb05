import { describe, expect, it } from "vitest";
import { benchOf, missingCount, missingLabel, slotsByTeam, type Player } from "@/lib/domain/match";
import { inviteMessage, matchTitle, whatsappUrl } from "@/lib/domain/share";

const p = (id: string, team: "A" | "B", slot: number | null): Player => ({ id, name: id, team, slot });

describe("match", () => {
  const match = { format: 5 as const, players: [p("a0", "A", 0), p("a3", "A", 3), p("b1", "B", 1), p("ab", "A", null)] };

  it("ubica a los titulares en su lugar y deja null los libres", () => {
    const s = slotsByTeam(match);
    expect(s.A.map((x) => x?.id ?? null)).toEqual(["a0", null, null, "a3", null]);
    expect(s.B.map((x) => x?.id ?? null)).toEqual([null, "b1", null, null, null]);
  });

  it("el banco no cuenta como lugar ocupado", () => {
    expect(benchOf(match, "A").map((x) => x.id)).toEqual(["ab"]);
    expect(missingCount(match)).toBe(7);
  });

  it("textos del contador", () => {
    expect(missingLabel(0)).toBe("¡Equipos completos!");
    expect(missingLabel(1)).toBe("Falta 1 jugador");
    expect(missingLabel(3)).toBe("Faltan 3 jugadores");
  });
});

describe("share", () => {
  it("arma el enlace de wa.me con el texto codificado", () => {
    const url = whatsappUrl(inviteMessage({ title: "Fútbol", when: "Viernes 21:00", venue: "Cancha & Co", url: "https://x/p/abc" }));
    expect(url.startsWith("https://wa.me/?text=")).toBe(true);
    const text = decodeURIComponent(url.split("text=")[1]);
    expect(text).toContain("Cancha & Co");
    expect(text).toContain("https://x/p/abc");
  });

  it("título por defecto si no hay nombre", () => {
    expect(matchTitle(null, "viernes")).toBe("Partido del viernes");
    expect(matchTitle("  ", "jueves")).toBe("Partido del jueves");
    expect(matchTitle("Fulbito", "jueves")).toBe("Fulbito");
  });
});
