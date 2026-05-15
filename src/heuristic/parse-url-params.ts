/**
 * Extracts query-string parameters from a request URL as a flat key/value map.
 *
 * Relative URLs are resolved against the current page when one is available.
 * Returns an empty object for unparseable URLs or URLs with no query string.
 * When a parameter repeats, the first occurrence wins — matching the
 * first-valid-value semantics the heuristic matcher applies to body aliases.
 */
export const parseUrlParams = (url: string): Record<string, string> => {
  let search: string;
  try {
    const base =
      typeof window !== "undefined" ? window.location.href : "http://localhost";
    search = new URL(url, base).search;
  } catch {
    return {};
  }

  const params: Record<string, string> = {};
  for (const [key, value] of new URLSearchParams(search)) {
    if (!(key in params)) params[key] = value;
  }
  return params;
};
