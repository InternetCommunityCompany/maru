# CLAUDE.md

Project-specific guidance for working in this repo.

## File organization

- **Split when a file holds two concerns that wouldn't share tests.** A file's name should describe what it exports.
- **Co-locate types with their producer.** No top-level `types.ts`. A dedicated `types.ts` is for modules with five-plus shared types where the separation actually helps navigation (`arbiter`, `dom-grounding`). Below that, put the type in the file that produces it; cross-module unions live with the consumer that combines them (e.g. `ChannelEvent` in `src/messaging.ts`).

## Documentation

- **Document non-obvious contracts.** Cover preconditions (e.g. "must be called at `document_start`"), side effects, error/empty-result conditions, and non-obvious return semantics. Skip the TSDoc when the signature already says everything a caller needs.
- **Don't restate the parameter types.** TypeScript already shows them. `@param` / `@returns` are for adding context the type misses; `@remarks` for design notes; `@example` for non-trivial usage.
- **Internal helpers don't need TSDoc.** A short `//` comment is enough — and only when the *why* isn't obvious.

## Design system

- **Tokens** in `src/assets/styles/tokens.css` — colors, spacing, radii, pixel shadows, fonts. Every surface imports it first.
- **Surface stylesheets** sit next to it: `popup.css`, `overlay.css`, `options.css`. Classnames are prefix-scoped (`.popup-*` popup, `.ol-*` overlay).
- **Use tokens, not raw values.** No hex or pixel values for shadows/radii on extension surfaces — add a token if one's missing.
- **Dark mode** is browser-driven via `@media (prefers-color-scheme: dark)` at the bottom of `tokens.css`.
- **`--on-accent`** is the foreground token for content sitting on a saturated brand fill (token icons, toggle thumbs, success-step glyphs). It's pinned across themes — use it instead of `--surface` whenever the *background* won't flip with the theme.
- **Fonts** (`Bagel Fat One`, `Nunito`, `JetBrains Mono`) are registered at runtime via `installFonts()` so the binaries don't get base64-inlined into the bundled CSS.
- **Asset URLs in content scripts** must go through `resolveAssetUrl()` so they resolve against the extension origin, not the host page.
