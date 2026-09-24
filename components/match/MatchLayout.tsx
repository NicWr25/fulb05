import type { ReactNode } from "react";

/**
 * Esqueleto de la vista del partido.
 *
 * El orden en el HTML es el del celular (una columna):
 *   cabecera → contador → cancha → card de acción → compartir.
 * En escritorio (lg) un grid con áreas con nombre ubica la cancha en una
 * columna ancha a la derecha y el resto en el aside de 344px, como el diseño.
 * Así no hay que duplicar componentes ni reordenar con JS, y el orden de
 * lectura con lector de pantalla sigue siendo lógico.
 */
export function MatchLayout({
  header,
  stat,
  pitch,
  card,
  share,
}: {
  header: ReactNode;
  stat: ReactNode;
  pitch: ReactNode;
  card?: ReactNode;
  share?: ReactNode;
}) {
  return (
    <main
      className={[
        "mx-auto flex w-full max-w-[440px] flex-col gap-[18px] px-4 pt-5 pb-8",
        "lg:grid lg:max-w-[1280px] lg:grid-cols-[344px_minmax(0,1fr)] lg:grid-rows-[auto_auto_1fr_auto]",
        "lg:gap-x-8 lg:gap-y-[22px] lg:p-8",
        "lg:[grid-template-areas:'header_pitch''stat_pitch''card_pitch''share_pitch']",
      ].join(" ")}
    >
      <div className="lg:[grid-area:header]">{header}</div>
      <div className="lg:[grid-area:stat]">{stat}</div>
      <div className="flex flex-col gap-[18px] lg:gap-4 lg:[grid-area:pitch]">{pitch}</div>
      {card && <div className="lg:[grid-area:card]">{card}</div>}
      {share && <div className="lg:self-end lg:[grid-area:share]">{share}</div>}
    </main>
  );
}
