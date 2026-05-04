/**
 * `JSON.parse` that returns `undefined` for any falsy input or parse error,
 * never throws. Used wherever we speculatively decode bodies that may not be
 * JSON.
 */
export const tryParseJson = (text: string | null | undefined): unknown => {
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};
