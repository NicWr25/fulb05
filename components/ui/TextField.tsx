import { useId, type InputHTMLAttributes, type ReactNode } from "react";
import { cx } from "@/lib/cx";

export type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id"> & {
  label: string;
  /** Texto gris al lado del label, ej. "(opcional)". */
  labelNote?: string;
  error?: string | null;
  hint?: ReactNode;
  /** Ícono dentro del input, a la izquierda (ej. el pin de Maps). */
  icon?: ReactNode;
  id?: string;
};

/**
 * Label + input + error + ayuda, conectados para lectores de pantalla:
 * aria-invalid marca el error y aria-describedby lee el error y la ayuda.
 * El input usa 16px de letra: con menos, iOS hace zoom al enfocar.
 */
export function TextField({ label, labelNote, error, hint, icon, id, className, ...input }: TextFieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;
  const describedBy = [error && errorId, hint && hintId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      <label htmlFor={inputId} className="text-13 font-semibold text-ink-2">
        {label}
        {labelNote && <span className="font-normal"> {labelNote}</span>}
      </label>
      <div className="relative flex">
        {icon && (
          <span className="pointer-events-none absolute top-1/2 left-3 flex -translate-y-1/2 text-ink-2">{icon}</span>
        )}
        <input
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cx(
            "h-[46px] min-w-0 grow rounded-field bg-field text-16 text-ink placeholder:text-ink-4",
            icon ? "pr-3.5 pl-[38px]" : "px-3.5",
            error ? "border-2 border-danger" : "border border-line-strong",
          )}
          {...input}
        />
      </div>
      {error && (
        <p id={errorId} className="text-13 text-danger">
          {error}
        </p>
      )}
      {hint && (
        <p id={hintId} className="text-13 leading-[1.45] text-ink-2">
          {hint}
        </p>
      )}
    </div>
  );
}
