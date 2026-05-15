/**
 * Common wrapper paths the heuristic walks before giving up on a field.
 *
 * APIs frequently bury swap data one level deep under an envelope key —
 * `response.data.*`, `response.quote.*`, `response.result.*`, and so on.
 * Adding each as a search scope lets the heuristic resolve aliases against
 * those shapes without exploding the alias list combinatorially. The empty
 * string is the unprefixed (root) scope and is always tried first so a
 * top-level field beats a nested one when both happen to be present.
 *
 * Drawn from cowswap (`quote`), pancakeswap (`data`), li.fi (`action`,
 * `estimate`), bungee (`result`). Extend as new shapes surface, but keep
 * the list short — every prefix multiplies the per-field probe count.
 */
export const NESTING_PREFIXES = [
  "",
  "data",
  "result",
  "quote",
  "action",
  "estimate",
] as const;
