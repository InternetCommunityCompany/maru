const navigate = (source: unknown, path: string): unknown => {
  if (path === "") return source;
  const parts = path.split(".");
  let cursor: unknown = source;
  for (const part of parts) {
    if (cursor == null || typeof cursor !== "object") return undefined;
    cursor = (cursor as Record<string, unknown>)[part];
  }
  return cursor;
};

/**
 * Walks `source` along each dot-path alias in turn and returns the first
 * value that passes `validate`. `validate` returns the typed/cleaned value
 * on success and `null` on failure — that double-purpose lets the caller
 * keep validation and coercion in one place per field.
 *
 * Returns `null` if no alias produces a valid value. Aliases that resolve
 * to `undefined` are skipped without invoking the validator.
 *
 * @param prefixes - Dot-path scopes to try in order. Defaults to `[""]` so
 *   only the root is searched. Pass extra scopes (e.g. `["", "data",
 *   "quote"]`) to also resolve aliases beneath common envelope keys; an
 *   alias is matched at the earliest prefix where it both resolves and
 *   validates, so root values beat nested ones.
 */
export const findByAliases = <T>(
  source: unknown,
  aliases: readonly string[],
  validate: (value: unknown) => T | null,
  prefixes: readonly string[] = [""],
): T | null => {
  for (const prefix of prefixes) {
    const scope = navigate(source, prefix);
    if (scope === undefined) continue;
    for (const alias of aliases) {
      const value = navigate(scope, alias);
      if (value === undefined) continue;
      const validated = validate(value);
      if (validated !== null) return validated;
    }
  }
  return null;
};
