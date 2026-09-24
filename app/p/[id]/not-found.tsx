import { NotFoundCard } from "@/components/match/NotFoundCard";

export default function MatchNotFound() {
  return (
    <NotFoundCard
      title="Este partido no existe o ya se borró"
      body="Revisá que el enlace esté completo. Los partidos se borran solos una semana después de jugarse."
    />
  );
}
