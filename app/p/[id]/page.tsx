import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MatchHeader } from "@/components/match/MatchHeader";
import { MatchLayout } from "@/components/match/MatchLayout";
import { MatchPitch } from "@/components/match/MatchPitch";
import { Rosters } from "@/components/match/Rosters";
import { ShareIconLink, ShareWideLink } from "@/components/match/ShareButtons";
import { TeamLegend } from "@/components/match/TeamLegend";
import { StatBox } from "@/components/ui/StatBox";
import { getMatchPreview } from "@/lib/supabase/server";
import { formatMatchDate, weekday } from "@/lib/domain/datetime";
import { missingCount, missingLabel } from "@/lib/domain/match";
import { inviteMessage, matchTitle, whatsappUrl } from "@/lib/domain/share";

// Diseño: design/jugador-{celular,escritorio}.dc.html
// Etapa (c): vista de solo lectura renderizada en el servidor.
// En la etapa (d) se suma la interacción (anotarse) del lado del cliente.

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
  const missing = missingCount(match);
  const closed = new Date(match.starts_at) <= new Date();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const shareHref = whatsappUrl(
    inviteMessage({ title, when, venue: match.venue, url: `${siteUrl}/p/${match.id}` }),
  );

  return (
    <MatchLayout
      header={
        <MatchHeader
          eyebrow={closed ? "Partido cerrado" : "Partido entre amigos"}
          title={title}
          when={when}
          venue={match.venue}
          mapsUrl={match.maps_url}
          organizer={match.organizer_name}
          action={<ShareIconLink href={shareHref} />}
        />
      }
      stat={
        closed ? (
          <StatBox value="—" title="Las inscripciones cerraron" subtitle="El partido ya empezó." />
        ) : (
          <StatBox
            value={missing}
            title={missingLabel(missing)}
            subtitle={`${match.format} vs ${match.format} · ${match.format * 2} jugadores en cancha`}
          />
        )
      }
      pitch={
        <>
          <TeamLegend />
          <MatchPitch match={match} />
          <p className="text-13 leading-[1.45] text-ink-2">
            Tocá un puesto libre para elegirlo. El organizador acomoda las posiciones.
          </p>
        </>
      }
      rosters={<Rosters match={match} />}
      share={<ShareWideLink href={shareHref} />}
    />
  );
}
