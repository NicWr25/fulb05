import type { ReactNode } from "react";

/** Caja "3 · Faltan 3 jugadores / 7 vs 7 · 14 jugadores en cancha". */
export function StatBox({ value, title, subtitle }: { value: ReactNode; title: ReactNode; subtitle?: ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-btn bg-sand px-3.5 py-3 lg:px-4 lg:py-3.5" role="status">
      <div className="min-w-7 text-center font-display text-26 font-extrabold tabular-nums lg:min-w-8 lg:text-28">
        {value}
      </div>
      <div className="flex flex-col gap-0.5">
        <div className="text-15 font-semibold">{title}</div>
        {subtitle && <div className="text-13 text-ink-2">{subtitle}</div>}
      </div>
    </div>
  );
}
