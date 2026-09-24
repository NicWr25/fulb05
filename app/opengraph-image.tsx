import { ImageResponse } from "next/og";
import { ogFonts } from "@/lib/og-fonts";

// Vista previa de la home (al compartir la app misma). Cada partido tiene la
// suya en app/p/[id]/opengraph-image.tsx, que tiene prioridad en esa ruta.
export const alt = "Armá el partido. Pasá el enlace.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const lines = ["Armá el partido.", "Pasá el enlace."];
  const sub = "Cada uno se anota solo, en su equipo y en su puesto.";
  const eyebrow = "ARMADO DE EQUIPOS";
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", gap: 28, padding: 80, background: "#F4F1EA", color: "#16181D" }}>
        <div style={{ display: "flex", fontSize: 26, letterSpacing: 3, color: "#5A5E66", fontFamily: "IBM Plex Sans", fontWeight: 600 }}>{eyebrow}</div>
        <div style={{ display: "flex", flexDirection: "column", fontSize: 104, lineHeight: 1, fontFamily: "Bricolage Grotesque", fontWeight: 800 }}>
          <div style={{ display: "flex" }}>{lines[0]}</div>
          <div style={{ display: "flex" }}>{lines[1]}</div>
        </div>
        <div style={{ display: "flex", fontSize: 36, color: "#4A4E57", fontFamily: "IBM Plex Sans" }}>{sub}</div>
      </div>
    ),
    { ...size, fonts: await ogFonts([eyebrow, ...lines, sub].join(" ")) },
  );
}
