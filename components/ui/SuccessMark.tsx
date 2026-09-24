import { cx } from "@/lib/cx";
import { CheckIcon } from "./icons";

/** Tilde verde en un círculo (¡Listo! / ¡Partido creado!). Decorativo. */
export function SuccessMark({ size = 28 }: { size?: 28 | 36 }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        "flex shrink-0 items-center justify-center rounded-full bg-success text-white",
        size === 28 ? "size-7" : "size-9",
      )}
    >
      <CheckIcon size={size === 28 ? 16 : 20} />
    </span>
  );
}
