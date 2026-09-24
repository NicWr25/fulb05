import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MatchClient } from "@/components/match/MatchClient";
import { getMatchPreview } from "@/lib/supabase/server";
import { ogDescription, ogTitle } from "@/lib/domain/og";
import { siteUrl } from "@/lib/site";

// Diseño: design/jugador-{celular,escritorio}.dc.html
// El servidor renderiza el estado inicial (rápido, sin spinner, y sirve para
// el preview de WhatsApp); MatchClient suma la sesión y las acciones.

/**
 * Metadatos por partido: lo que muestra WhatsApp al pegar el link.
 * El bot de WhatsApp no ejecuta JavaScript: lee estas etiquetas <meta> del
 * HTML que genera el servidor. La imagen la arma opengraph-image.tsx.
 */
export async function generateMetadata({ params }: PageProps<"/p/[id]">): Promise<Metadata> {
  const { id } = await params;
  const match = await getMatchPreview(id);
  if (!match) return { title: "Partido no encontrado", robots: { index: false } };

  const closed = Date.parse(match.starts_at) <= Date.parse(match.server_now);
  const title = ogTitle(match);
  const description = ogDescription(match, { closed });
  return {
    title: { absolute: title },
    description,
    // Los partidos son privados ("el link es la llave"): que no aparezcan en
    // buscadores. Los bots de vista previa (WhatsApp) igual leen las etiquetas.
    robots: { index: false, follow: false },
    // openGraph REEMPLAZA (no combina) al del layout raíz: se repiten siteName y locale.
    openGraph: { title, description, url: `/p/${match.id}`, siteName: "Armá el partido", locale: "es_UY", type: "website" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function MatchPage({ params }: PageProps<"/p/[id]">) {
  const { id } = await params;
  const match = await getMatchPreview(id);
  if (!match) notFound();

  return <MatchClient initial={match} renderedAt={Date.parse(match.server_now)} publicUrl={`${siteUrl()}/p/${match.id}`} />;
}
