import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";

// next/font descarga las fuentes en el build y las sirve desde nuestro dominio:
// el navegador no le pide nada a Google (privacidad) y reserva el espacio del
// texto con una fuente de respaldo ajustada, sin saltos de layout (CLS).
// Ambas son fuentes variables: un solo archivo por fuente cubre todos los pesos.
const plex = IBM_Plex_Sans({
  subsets: ["latin"],
  variable: "--font-plex",
  display: "swap",
});

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  axes: ["opsz"], // el diseño usa el eje de tamaño óptico (12..96)
  display: "swap",
});

export const metadata: Metadata = {
  title: "Armá el partido",
  description: "Armá equipos de fútbol 5 o 7 y pasá el enlace por WhatsApp.",
};

export const viewport: Viewport = {
  themeColor: "#f4f1ea",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-UY" className={`${plex.variable} ${bricolage.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
