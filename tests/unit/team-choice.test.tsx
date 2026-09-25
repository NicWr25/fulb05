import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { TeamChoice } from "@/components/match/TeamChoice";
import { PlayerToken } from "@/components/pitch/PlayerToken";

describe("selector de equipo y etiquetas de cancha", () => {
  it("mantiene activo el equipo actual y deshabilita el destino lleno", () => {
    const html = renderToStaticMarkup(<TeamChoice team="A" label="Tu equipo"
      onTeam={() => {}} unavailable={() => true} />);
    expect(html).toContain('role="group" aria-label="Tu equipo"');
    expect(html).toMatch(/<button[^>]*aria-pressed="true"[^>]*>.*Blanco<\/button>/);
    expect(html).toMatch(/<button[^>]*aria-pressed="false"[^>]*disabled=""[^>]*>.*Negro<\/button>/);
    expect(html.match(/<button[^>]*aria-pressed="true"[^>]*>/)?.[0]).toContain("bg-surface");
    expect(html.match(/<button[^>]*aria-pressed="false"[^>]*>/)?.[0]).toContain("bg-cream");
  });

  it("pone la etiqueta de una ficha cercana al borde inferior encima en celular", () => {
    const html = renderToStaticMarkup(<PlayerToken team="A" text="NI"
      playerName="Nico" tagAboveMobile aria-label="Nico en Blanco" />);
    expect(html).toContain("bottom-full mb-[3px]");
    expect(html).toContain("lg:top-full");
  });

  it("marca claramente la ficha propia cuando el organizador la selecciona", () => {
    const html = renderToStaticMarkup(<PlayerToken team="B" text="NI"
      playerName="Nico" mine selected aria-label="Tu ficha" />);
    expect(html).toContain("border-gold");
    expect(html).toContain("shadow-token-sel");
  });
});
