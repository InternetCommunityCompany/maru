/**
 * Awaits a possibly-failing text reader and returns `null` on any failure.
 *
 * Used to extract request/response bodies that may be unreadable streams,
 * already-consumed, or non-text content. Never throws.
 */
export const safeText = async (
  reader: () =>
    | Promise<string | null | undefined>
    | string
    | null
    | undefined,
): Promise<string | null> => {
  try {
    const value = await reader();
    return typeof value === "string" ? value : null;
  } catch {
    return null;
  }
};
