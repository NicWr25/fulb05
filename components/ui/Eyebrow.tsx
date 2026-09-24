import type { HTMLAttributes } from "react";
import { cx } from "@/lib/cx";

/** Texto chico en mayúsculas espaciadas que va arriba de los títulos. */
export function Eyebrow({ className, ...rest }: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cx("text-11 font-semibold tracking-eyebrow text-ink-3 uppercase lg:text-12", className)} {...rest} />
  );
}
