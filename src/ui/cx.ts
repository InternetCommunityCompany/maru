/**
 * Concatenate class names, ignoring falsy parts and trimming whitespace so
 * the output never starts/ends with a space.
 *
 * @example
 * cx("popup-toggle", enabled && "on") // "popup-toggle on" or "popup-toggle"
 */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
