import { ImageResponse } from "next/og";
import { getMatchPreview } from "@/lib/supabase/server";
import { ogImageData } from "@/lib/domain/og";
import { ogFonts } from "@/lib/og-fonts";

// Imagen de la vista previa de WhatsApp (1200×630 es el tamaño estándar de OG).
export const alt = "Partido de fútbol: día, hora, cancha y cuántos jugadores faltan";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Colores del diseño (Satori no lee las variables CSS de Tailwind).
const C = {
  cream: "#F4F1EA",
  sand: "#E6E1D5",
  ink: "#16181D",
  ink2: "#4A4E57",
  ink3: "#5A5E66",
  pitch: "#2F7F4F",
  pitchAlt: "#2A7447",
  teamA: "#F2EEE3",
  teamB: "#1F2A5C",
  swatch: "#8A8577",
};

/**
 * Satori (el motor de next/og) soporta un subconjunto de CSS: solo flexbox,
 * estilos inline, y todo <div> con más de un hijo necesita display: flex.
 */
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const match = await getMatchPreview(id);

  if (!match) {
    const text = "Este partido no existe o ya se borró";
    return new ImageResponse(
      (
        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: C.cream, color: C.ink, fontSize: 56, fontFamily: "Bricolage Grotesque" }}>
          {text}
        </div>
      ),
      { ...size, fonts: await ogFonts(text) },
    );
  }

  const d = ogImageData(match);
  const eyebrow = "PARTIDO ENTRE AMIGOS";
  const formatLine = `${d.format} vs ${d.format}`;
  const allText = [eyebrow, d.title, d.when, d.venue, d.missing, d.missingText, formatLine, "Claros", "Oscuros", `${d.claros}/${d.format}`, `${d.oscuros}/${d.format}`].join(" ");

  const team = (label: string, count: number, bg: string, fg: string) => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
      <div
        style={{
          width: 120,
          height: 120,
          borderRadius: 60,
          background: bg,
          color: fg,
          border: "4px solid #FFFFFF",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 40,
          fontFamily: "IBM Plex Sans",
          fontWeight: 600,
          boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
        }}
      >
        {`${count}/${d.format}`}
      </div>
      <div style={{ display: "flex", padding: "4px 14px", borderRadius: 8, background: "rgba(12,20,16,0.72)", color: "#FFFFFF", fontSize: 26, fontFamily: "IBM Plex Sans", fontWeight: 600 }}>
        {label}
      </div>
    </div>
  );

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: C.cream, padding: 64, gap: 56, color: C.ink }}>
        {/* Columna de texto */}
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flexGrow: 1, width: 560 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", fontSize: 24, letterSpacing: 3, color: C.ink3, fontFamily: "IBM Plex Sans", fontWeight: 600 }}>
              {eyebrow}
            </div>
            <div style={{ display: "flex", fontSize: 72, lineHeight: 1.02, fontFamily: "Bricolage Grotesque", fontWeight: 800 }}>
              {d.title}
            </div>
            <div style={{ display: "flex", fontSize: 34, color: C.ink2, fontFamily: "IBM Plex Sans" }}>{d.when}</div>
            <div style={{ display: "flex", fontSize: 34, color: "#1F5C3A", fontFamily: "IBM Plex Sans", fontWeight: 600 }}>
              {d.venue}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 24, padding: "22px 28px", borderRadius: 20, background: C.sand }}>
            <div style={{ display: "flex", fontSize: 72, fontFamily: "Bricolage Grotesque", fontWeight: 800 }}>{String(d.missing)}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <div style={{ display: "flex", fontSize: 34, fontFamily: "IBM Plex Sans", fontWeight: 600 }}>{d.missingText}</div>
              <div style={{ display: "flex", fontSize: 26, color: C.ink2, fontFamily: "IBM Plex Sans" }}>{formatLine}</div>
            </div>
          </div>
        </div>

        {/* Cancha */}
        <div
          style={{
            display: "flex",
            width: 440,
            height: 502,
            borderRadius: 22,
            position: "relative",
            alignItems: "center",
            justifyContent: "space-around",
            flexDirection: "column",
            backgroundImage: `repeating-linear-gradient(180deg, ${C.pitch} 0px, ${C.pitch} 42px, ${C.pitchAlt} 42px, ${C.pitchAlt} 84px)`,
            border: "3px solid rgba(255,255,255,0.8)",
          }}
        >
          <div style={{ position: "absolute", left: 0, right: 0, top: 249, height: 3, background: "rgba(255,255,255,0.8)", display: "flex" }} />
          <div style={{ position: "absolute", left: 160, top: 190, width: 120, height: 120, borderRadius: 60, border: "3px solid rgba(255,255,255,0.8)", display: "flex" }} />
          {team("Oscuros", d.oscuros, C.teamB, "#FFFFFF")}
          {team("Claros", d.claros, C.teamA, C.ink)}
        </div>
      </div>
    ),
    { ...size, fonts: await ogFonts(allText) },
  );
}
