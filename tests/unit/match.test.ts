import { describe, expect, it } from "vitest";
import { hasNameInTeam, missingCount, missingLabel, playerDisplayName, slotsByTeam, type Player } from "@/lib/domain/match";
import { inviteMessage, matchTitle, whatsappUrl } from "@/lib/domain/share";

const p = (id: string, team: "A" | "B", slot: number): Player => ({ id, name: id, team, slot });

describe("match", () => {
  const match = { format: 5 as const, players: [p("a0", "A", 0), p("a3", "A", 3), p("b1", "B", 1)] };

  it("ubica a los titulares en su lugar y deja null los libres", () => {
    const s = slotsByTeam(match);
    expect(s.A.map((x) => x?.id ?? null)).toEqual(["a0", null, null, "a3", null]);
    expect(s.B.map((x) => x?.id ?? null)).toEqual([null, "b1", null, null, null]);
  });

  it("cuenta los lugares libres", () => {
    expect(missingCount(match)).toBe(7);
  });

  it("textos del contador", () => {
    expect(missingLabel(0)).toBe("¡Equipos completos!");
    expect(missingLabel(1)).toBe("Falta 1 jugador");
    expect(missingLabel(3)).toBe("Faltan 3 jugadores");
  });

  it("distingue nombres repetidos por equipo y lugar, también si ya existían", () => {
    const players: Player[] = [
      { id: "1", name: "Jugador QA 1", team: "A", slot: 1 },
      { id: "2", name: "jugador  qa 1", team: "A", slot: 4 },
      { id: "3", name: "Jugador QA 1", team: "B", slot: 0 },
    ];
    expect(playerDisplayName(players[0], players)).toBe("2 · Jugador QA 1");
    expect(playerDisplayName(players[1], players)).toBe("5 · jugador  qa 1");
    expect(playerDisplayName(players[2], players)).toBe("Jugador QA 1");
    expect(hasNameInTeam("JUGADOR QA 1", "A", players)).toBe(true);
    expect(hasNameInTeam("JUGADOR QA 1", "B", players)).toBe(true);
  });

  it("muestra alias y numera también alias repetidos", () => {
    const players: Player[] = [
      { id: "1", name: "Juan", alias: "Juani", team: "A", slot: 0 },
      { id: "2", name: "Pedro", alias: "Juani", team: "A", slot: 3 },
    ];
    expect(playerDisplayName(players[0], players)).toBe("1 · Juani");
    expect(playerDisplayName(players[1], players)).toBe("4 · Juani");
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
    expect(matchTitle(null, "Nico")).toBe("Partido de Nico");
    expect(matchTitle("  ", "Ana")).toBe("Partido de Ana");
    expect(matchTitle("Fulbito", "jueves")).toBe("Fulbito");
  });
});
