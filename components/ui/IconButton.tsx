import type { ButtonHTMLAttributes } from "react";
import { cx } from "@/lib/cx";

/** Botón cuadrado de 44×44 (mínimo táctil) con borde tinta. Requiere aria-label. */
export function IconButton({
  className,
  type = "button",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { "aria-label": string }) {
  return (
    <button
      type={type}
      className={cx(
        "flex size-11 shrink-0 items-center justify-center rounded-btn border border-ink bg-transparent text-ink",
        className,
      )}
      {...rest}
    />
  );
}
