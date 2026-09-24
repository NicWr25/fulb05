import { cx } from "@/lib/cx";
import { PinIcon } from "./icons";

/**
 * Enlace "Cancha X · Cómo llegar".
 * Accesibilidad: el diseño lo hace de 32px de alto. Se mantiene el tamaño
 * visual, pero un pseudo-elemento extiende el área táctil a 44px.
 */
export function MapsLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cx(
        "relative inline-flex min-h-8 items-center gap-1.5 self-start font-semibold text-link-green underline underline-offset-[3px] hover:text-link-green",
        "after:absolute after:inset-x-0 after:-inset-y-1.5",
        className,
      )}
    >
      <PinIcon />
      {children}
    </a>
  );
}
