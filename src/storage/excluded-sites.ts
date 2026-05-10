/**
 * Persistent list of hostnames where MARU is paused. The popup, content
 * script overlay, and options page all read/write through this single item
 * so their views stay in sync.
 */
export const excludedSites = storage.defineItem<string[]>(
  "local:excludedSites",
  {
    fallback: [],
  },
);

/**
 * Normalise a user-entered site reference (URL, host, or `https://...`) into
 * a bare hostname the exclusion list expects. Returns an empty string when
 * the input is unusable so callers can short-circuit.
 */
export function normaliseSite(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");
}
