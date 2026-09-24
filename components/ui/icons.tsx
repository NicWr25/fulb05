import type { SVGProps } from "react";

// Íconos de trazo copiados de los prototipos (24x24, currentColor).
// Son decorativos: el texto o el aria-label del botón es lo que se anuncia.
type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Stroke({ size = 16, strokeWidth = 2, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className="shrink-0"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const LinkIcon = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5" />
    <path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5" />
  </Stroke>
);

export const PinIcon = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M12 21s-7-6.1-7-11.5a7 7 0 0 1 14 0C19 14.9 12 21 12 21z" />
    <circle cx="12" cy="9.5" r="2.5" />
  </Stroke>
);

export const CheckIcon = (p: IconProps) => (
  <Stroke strokeWidth={2.6} {...p}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </Stroke>
);

export const XIcon = (p: IconProps) => (
  <Stroke size={14} strokeWidth={2.4} {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Stroke>
);

export const ResetIcon = (p: IconProps) => (
  <Stroke size={18} {...p}>
    <path d="M3 12a9 9 0 1 0 3-6.7" />
    <path d="M3 4v5h5" />
  </Stroke>
);

export const EditIcon = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
  </Stroke>
);

/** Logo de WhatsApp (relleno). No está en el diseño: se agrega por el botón de compartir. */
export const WhatsAppIcon = ({ size = 18, ...rest }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false" className="shrink-0" {...rest}>
    <path d="M12.04 2a9.9 9.9 0 0 0-8.5 14.98L2 22l5.16-1.5A9.9 9.9 0 1 0 12.04 2zm0 18.1a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.06.89.9-2.98-.2-.31a8.2 8.2 0 1 1 6.84 3.73zm4.5-6.14c-.25-.12-1.46-.72-1.69-.8-.23-.08-.39-.12-.55.12-.16.25-.63.8-.78.96-.14.16-.29.18-.53.06a6.7 6.7 0 0 1-3.34-2.92c-.25-.43.25-.4.72-1.34.08-.16.04-.3-.02-.42-.06-.12-.55-1.33-.76-1.82-.2-.48-.4-.41-.55-.42h-.47a.9.9 0 0 0-.65.3 2.74 2.74 0 0 0-.86 2.04 4.76 4.76 0 0 0 1 2.53 10.9 10.9 0 0 0 4.17 3.68c1.55.67 2.16.73 2.94.61.47-.07 1.46-.6 1.66-1.18.2-.58.2-1.07.14-1.18-.06-.1-.22-.16-.47-.28z" />
  </svg>
);
