import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MatchClient } from "@/components/match/MatchClient";
import { getMatchPreview } from "@/lib/supabase/server";
import { formatMatchDate, weekday } from "@/lib/domain/datetime";
import { inviteMessage, matchTitle, whatsappUrl } from "@/lib/domain/share";

// Diseño: design/jugador-{celular,escritorio}.dc.html
// El servidor renderiza el estado inicial (rápido, sin spinner, y sirve para
// el preview de WhatsApp); MatchClient suma la sesión y las acciones.

export async function generateMetadata({ params }: PageProps<"/p/[id]">): Promise<Metadata> {
  const { id } = await params;
  const match = await getMatchPreview(id);
  if (!match) return { title: "Partido no encontrado" };
  return { title: matchTitle(match.title, weekday(match.starts_at, match.timezone)) };
}

export default async function MatchPage({ params }: PageProps<"/p/[id]">) {
  const { id } = await params;
  const match = await getMatchPreview(id);
  if (!match) notFound();

  const title = matchTitle(match.title, weekday(match.starts_at, match.timezone));
  const when = formatMatchDate(match.starts_at, match.timezone);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const shareHref = whatsappUrl(inviteMessage({ title, when, venue: match.venue, url: `${siteUrl}/p/${match.id}` }));

  return <MatchClient initial={match} renderedAt={Date.parse(match.server_now)} shareHref={shareHref} />;
}
