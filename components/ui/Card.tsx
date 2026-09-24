import type { HTMLAttributes } from "react";
import { cx } from "@/lib/cx";

/** Card blanca con borde suave. `panel` = la card grande de "Crear partido". */
export function Card({ panel, className, ...rest }: HTMLAttributes<HTMLDivElement> & { panel?: boolean }) {
  return (
    <div
      className={cx(
        "flex flex-col border border-line bg-surface",
        panel ? "gap-4 rounded-panel p-5 lg:p-7" : "gap-3 rounded-card p-4 lg:gap-3.5 lg:p-5",
        className,
      )}
      {...rest}
    />
  );
}

export function CardTitle({ className, ...rest }: HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cx("font-display text-20 font-extrabold", className)} {...rest} />;
}
