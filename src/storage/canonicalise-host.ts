/**
 * Reduce a hostname or URL fragment to the canonical key MARU stores in
 * the excluded-sites list.
 *
 * @remarks
 * The popup, options page, and content script all need to compare a host
 * against the same canonical form, otherwise toggling on `www.foo.com`
 * doesn't match an entry typed as `foo.com`. Returns an empty string when
 * the input doesn't parse to a host so callers can short-circuit.
 *
 * Strips:
 * - Surrounding whitespace and case
 * - Schemes (`http://`, `https://`)
 * - Path / query / hash components
 * - The `www.` subdomain prefix
 */
export function canonicaliseHost(input: string): string {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return "";
  const withScheme = /^[a-z]+:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;
  let host: string;
  try {
    host = new URL(withScheme).hostname;
  } catch {
    return "";
  }
  return host.replace(/^www\./, "");
}
