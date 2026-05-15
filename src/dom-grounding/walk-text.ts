import type { TextNodeSnapshot } from "./types";

// Walks at most this many ancestors when collecting context text and aria
// flags. Bounded so a deeply-nested hit doesn't pull half the page in for
// the matcher to scan.
const ANCESTOR_DEPTH = 8;
// Minimum context-text length we'll accept from an ancestor. We walk up
// until the cumulative innerText crosses this threshold so a single tight
// `<span>` doesn't pass for "context" — labels and proximity hits live in
// the surrounding card, not the digit span itself.
const MIN_CONTEXT_CHARS = 30;

// HTML tags whose text content is not visible to the user and must not seed
// matcher hits. `<noscript>` is included even though it's usually hidden —
// some pages keep dev-only payloads there.
const SKIP_TAGS = new Set([
  "SCRIPT",
  "STYLE",
  "NOSCRIPT",
  "TEMPLATE",
  "META",
  "LINK",
  "HEAD",
]);

const isElement = (n: Node): n is Element => n.nodeType === 1;

const climbAncestors = (
  start: Node,
): { contextText: string; ariaSelected: boolean; ariaChecked: boolean } => {
  let contextText = "";
  let ariaSelected = false;
  let ariaChecked = false;
  let el: Element | null = start.parentElement;
  for (let depth = 0; depth < ANCESTOR_DEPTH && el !== null; depth++) {
    if (el.getAttribute("aria-selected") === "true") ariaSelected = true;
    if (
      el.getAttribute("role") === "radio" &&
      el.getAttribute("aria-checked") === "true"
    ) {
      ariaChecked = true;
    }
    if (contextText.length < MIN_CONTEXT_CHARS) {
      const txt = el.textContent;
      if (txt && txt.length > contextText.length) contextText = txt;
    }
    el = el.parentElement;
  }
  return { contextText, ariaSelected, ariaChecked };
};

const visitInto = (root: Node, out: TextNodeSnapshot[]): void => {
  // Iterative DFS — recursion blows the stack on chat-app-scale DOMs.
  const stack: Node[] = [root];
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (node.nodeType === 3) {
      const text = (node as Text).data;
      if (text.trim().length === 0) continue;
      const { contextText, ariaSelected, ariaChecked } = climbAncestors(node);
      out.push({ text, contextText, ariaSelected, ariaChecked });
      continue;
    }
    if (!isElement(node)) {
      // Document / DocumentFragment / ShadowRoot. Walk children.
      for (let i = node.childNodes.length - 1; i >= 0; i--) {
        stack.push(node.childNodes[i]!);
      }
      continue;
    }
    if (SKIP_TAGS.has(node.tagName)) continue;
    // Open shadow root — closed shadow DOM returns `null` here and is
    // explicitly out of scope for V1.
    const shadow = (node as Element).shadowRoot;
    if (shadow) stack.push(shadow);
    if (node.tagName === "IFRAME") {
      try {
        const doc = (node as HTMLIFrameElement).contentDocument;
        // Cross-origin access throws or returns `null`; both fall through to
        // skipping. The V1 spike found no cross-origin iframes anyway.
        if (doc && doc.body) stack.push(doc.body);
      } catch {
        // intentionally swallow — see comment above
      }
    }
    for (let i = node.childNodes.length - 1; i >= 0; i--) {
      stack.push(node.childNodes[i]!);
    }
  }
};

/**
 * Walk the rendered DOM and collect every visible text node, annotated with
 * the ancestor-derived context the matcher needs.
 *
 * Traverses open shadow roots and same-origin iframes; closed shadow DOM
 * and cross-origin iframes are silently skipped (V1-target dapps don't use
 * them — if a future dapp regresses, the matcher falls through to the no-
 * grounding tier rather than crashing).
 *
 * @remarks
 * Returns a flat array because the matcher only ever needs to iterate; it
 * never has to look up by parent. Whitespace-only text nodes are dropped
 * here so the matcher doesn't have to filter every scan.
 *
 * @param root - Subtree to walk. Defaults to `document.body`; falls back to
 *   `document` when called before `<body>` exists.
 */
export function walkText(root?: Node): TextNodeSnapshot[] {
  const start = root ?? document.body ?? document;
  const out: TextNodeSnapshot[] = [];
  visitInto(start, out);
  return out;
}
