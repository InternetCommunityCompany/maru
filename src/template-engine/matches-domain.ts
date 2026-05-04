/**
 * Resolves the domain string a template matched against, or `null` if it
 * didn't match.
 *
 * If `domains` is undefined or empty, the template imposes no domain
 * restriction and the actual `host` is returned (so the resulting
 * `SwapEvent.domain` still records where the swap happened). Otherwise
 * `host` must equal one of the entries or be a subdomain of one (so
 * `app.jumper.xyz` matches `jumper.xyz`); the matched entry is returned.
 */
export const matchesDomain = (
  host: string,
  domains: string[] | undefined,
): string | null => {
  if (!domains || domains.length === 0) return host;
  for (const d of domains) {
    if (host === d || host.endsWith(`.${d}`)) return d;
  }
  return null;
};
