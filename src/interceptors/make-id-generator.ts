/**
 * Returns a thunk that produces unique, opaque IDs for one interceptor source.
 *
 * Each call to the returned function yields a fresh ID prefixed with the given
 * `prefix` and a per-call-site session salt, so IDs are unique within a page
 * even across multiple interceptors and reloads.
 *
 * @example
 * const nextId = makeIdGenerator("fetch");
 * nextId(); // "fetch-h7k2a-1"
 */
export const makeIdGenerator = (prefix: string) => {
  let n = 0;
  const session = Math.random().toString(36).slice(2, 8);
  return () => `${prefix}-${session}-${(++n).toString(36)}`;
};
