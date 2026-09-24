"use client";

import { useEffect, useState, type ReactNode } from "react";
import { cx } from "@/lib/cx";

/**
 * Caja con un enlace y un botón "Copiar".
 * tone="admin": fondo amarillo de advertencia (enlace secreto de organizador).
 */
export function LinkBox({
  title,
  url,
  note,
  tone = "public",
  displayUrl,
}: {
  title: string;
  url: string;
  note?: ReactNode;
  tone?: "public" | "admin";
  /** Texto a mostrar si no se quiere mostrar la URL completa. */
  displayUrl?: string;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // Sin permiso de portapapeles (ej. navegador interno de algunas apps):
      // se selecciona el texto para que la persona lo copie a mano.
      window.prompt("Copiá el enlace:", url);
    }
  }

  const admin = tone === "admin";
  return (
    <div
      className={cx(
        "flex flex-col gap-2 rounded-box p-4",
        admin ? "border border-admin-border bg-me-bg" : "bg-cream",
      )}
    >
      <div className="text-15 font-semibold">{title}</div>
      <div className="flex items-center gap-2">
        <div
          className={cx(
            "flex h-11 min-w-0 grow items-center truncate rounded-field border bg-surface px-3 text-14",
            admin ? "border-admin-border" : "border-line",
          )}
        >
          <span className="truncate">{displayUrl ?? url}</span>
        </div>
        <button
          type="button"
          onClick={copy}
          className={cx(
            "h-11 shrink-0 rounded-field px-4 text-15 font-semibold",
            admin ? "border border-ink bg-surface text-ink" : "border-0 bg-ink text-white",
          )}
        >
          {copied ? "Copiado" : "Copiar"}
        </button>
      </div>
      {/* Anuncia "Enlace copiado" a lectores de pantalla sin mover el foco. */}
      <span className="sr-only" aria-live="polite">
        {copied ? "Enlace copiado" : ""}
      </span>
      {note && (
        <div className={cx("text-13 leading-[1.45]", admin ? "text-admin-ink" : "text-ink-2")}>{note}</div>
      )}
    </div>
  );
}
