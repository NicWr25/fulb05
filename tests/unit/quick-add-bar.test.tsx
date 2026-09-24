import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { QuickAddBar } from "@/components/match/QuickAddBar";

describe("barra de inscripción", () => {
  it("deja elegir Negro aunque Blanco esté lleno y seleccionado", () => {
    const html = renderToStaticMarkup(<QuickAddBar
      name="Jugador"
      onName={() => {}}
      team="A"
      onTeam={() => {}}
      teamDisabled={(team) => team === "A"}
      hint="Blanco está completo"
      placeholder="Nombre del jugador"
      submitLabel="+ Agregar"
      disabled
      onSubmit={() => {}}
    />);

    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>[^<]*<[^>]*>.*Blanco<\/button>/);
    expect(html).toMatch(/<button[^>]*aria-pressed="false"[^>]*>[^<]*<[^>]*>.*Negro<\/button>/);
    expect(html).not.toMatch(/<button[^>]*aria-pressed="false"[^>]*disabled/);
    expect(html.match(/<button[^>]*aria-pressed="true"[^>]*>/)?.[0]).toContain("bg-surface");
    expect(html.match(/<button[^>]*aria-pressed="false"[^>]*>/)?.[0]).toContain("bg-cream");
  });
});
