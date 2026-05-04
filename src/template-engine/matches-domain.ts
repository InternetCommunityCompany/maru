/**
 * Returns the matched domain string if `host` equals any entry in `domains`
 * or is a subdomain of one (so `app.jumper.xyz` matches `jumper.xyz`).
 * Returns `null` if no domain matches.
 */
export const matchesDomain = (
  host: string,
  domains: string[],
): string | null => {
  for (const d of domains) {
    if (host === d || host.endsWith(`.${d}`)) return d;
  }
  return null;
};
