import type { ButtonHTMLAttributes } from "react";
import { cx } from "@/lib/cx";

type Variant = "primary" | "outline" | "soft" | "ghost";
type Size = "lg" | "md" | "sm";

const VARIANT: Record<Variant, string> = {
  // CTA principal: fondo tinta, texto blanco.
  primary: "border-0 bg-ink text-white disabled:bg-ink-4",
  // Secundario: borde tinta, fondo transparente (Compartir, Copiar admin).
  outline: "border border-ink bg-transparent text-ink",
  // Acción suave sobre card blanca (Bajarme del partido).
  soft: "border border-line-strong bg-surface text-ink",
  // Enlace-botón subrayado (Crear otro partido).
  ghost: "border-0 bg-transparent text-ink-2 underline underline-offset-2",
};

// Alturas del diseño: 52px (CTA en celular), 48px (CTA en escritorio / Bajarme), 44px.
const SIZE: Record<Size, string> = {
  lg: "h-13 rounded-btn text-16 lg:text-17",
  md: "h-12 rounded-btn text-15",
  sm: "h-11 rounded-field px-4 text-15",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  /** Texto en rojo (acciones destructivas, ej. "Bajarme del partido"). */
  danger?: boolean;
};

export function Button({ variant = "primary", size = "lg", danger, className, type = "button", ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(
        "inline-flex items-center justify-center gap-2 font-semibold transition-colors",
        VARIANT[variant],
        SIZE[size],
        danger && "text-danger",
        className,
      )}
      {...rest}
    />
  );
}
