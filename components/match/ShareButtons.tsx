import { WhatsAppIcon } from "@/components/ui/icons";
import { cx } from "@/lib/cx";

/**
 * Compartir por WhatsApp. En el diseño este botón copiaba el enlace; el spec
 * pide wa.me, así que el ícono es de WhatsApp. En celular va como ícono en la
 * cabecera; en escritorio, como botón ancho al pie del aside.
 */
export function ShareIconLink({ href }: { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Invitar por WhatsApp"
      className="flex size-11 shrink-0 items-center justify-center rounded-btn border border-ink text-ink hover:text-ink lg:hidden"
    >
      <WhatsAppIcon />
    </a>
  );
}

export function ShareWideLink({ href, className }: { href: string; className?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cx(
        "hidden h-12 items-center justify-center gap-2.5 rounded-btn border border-ink text-16 font-semibold text-ink no-underline hover:text-ink lg:flex",
        className,
      )}
    >
      <WhatsAppIcon />
      Invitar por WhatsApp
    </a>
  );
}
