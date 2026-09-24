import type { Metadata } from "next";
import "./globals.css";

// Etapa (a): layout mínimo. Las fuentes y los design tokens llegan en la etapa (b2).
export const metadata: Metadata = {
  title: "Armá el partido",
  description: "Armá equipos de fútbol 5 o 7 y pasá el enlace por WhatsApp.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-UY" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
