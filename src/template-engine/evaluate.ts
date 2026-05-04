import type { EvalContext } from "./types";

type Token = { kind: "key"; key: string } | { kind: "index"; index: number };

const TOKEN_RE = /\.([^.\[]+)|\[(\d+)\]/g;

function parsePath(expr: string): { source: string; tokens: Token[] } | null {
  if (!expr.startsWith("$")) return null;
  const match = expr.match(/^\$([A-Za-z_]\w*)(.*)$/);
  if (!match) return null;
  const [, source, rest] = match;
  const tokens: Token[] = [];
  TOKEN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  let consumed = 0;
  while ((m = TOKEN_RE.exec(rest)) !== null) {
    if (m.index !== consumed) return null;
    if (m[1] !== undefined) tokens.push({ kind: "key", key: m[1] });
    else tokens.push({ kind: "index", index: parseInt(m[2]!, 10) });
    consumed += m[0].length;
  }
  if (consumed !== rest.length) return null;
  return { source, tokens };
}

/**
 * Resolves a template path expression against an `EvalContext`.
 *
 * Grammar: `$<source>` followed by zero or more `.<key>` accessors and
 * `[<n>]` numeric indices. Returns `undefined` for unparseable expressions,
 * unknown sources, or any null/missing intermediate. There is no wildcard,
 * slice, filter, or arithmetic — see `docs/templates.md`.
 *
 * @example
 * evaluate("$item.steps[0].toolDetails.name", ctx); // "Squid"
 */
export function evaluate(expr: string, ctx: EvalContext): unknown {
  const parsed = parsePath(expr);
  if (!parsed) return undefined;
  let cursor: unknown = (ctx as Record<string, unknown>)[parsed.source];
  for (const tok of parsed.tokens) {
    if (cursor == null) return undefined;
    if (tok.kind === "key") {
      cursor = (cursor as Record<string, unknown>)[tok.key];
    } else {
      cursor = Array.isArray(cursor) ? cursor[tok.index] : undefined;
    }
  }
  return cursor;
}
