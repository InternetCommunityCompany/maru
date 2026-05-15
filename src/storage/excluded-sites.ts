/**
 * Persistent list of hostnames where MARU is paused. The popup, content
 * script overlay, and options page all read/write through this single item
 * so their views stay in sync.
 *
 * Entries are stored in the canonical form returned by
 * {@link canonicaliseHost}.
 */
export const excludedSites = storage.defineItem<string[]>(
  "local:excludedSites",
  {
    fallback: [],
    version: 1,
  },
);
