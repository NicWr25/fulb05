/**
 * Une clases condicionales: cx("a", cond && "b", undefined) -> "a b".
 * Reemplaza a `clsx` con 3 líneas (no hace falta una dependencia para esto).
 */
export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
