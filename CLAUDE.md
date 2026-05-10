# CLAUDE.md

Project-specific guidance for working in this repo.

## File organization

- **One file = one export.** Don't bundle unrelated things into the same module. A file's name should describe what it exports.
- **More files > longer files.** When a file starts holding more than one concern, split it.
- **Co-locate types with their producer.** No top-level `types.ts`. Each module owns the types it emits in its own `types.ts` next to the implementation (e.g. `src/parser/types.ts`, `src/templates/types.ts`). Cross-module unions live with the consumer that combines them (e.g. `ChannelEvent` in `src/messaging.ts`).

## Documentation

- **Every exported function, class, type, and constant gets a TSDoc comment.** One-sentence summary on the first line; add a blank line and further paragraphs only for behaviour that isn't obvious from the signature.
- **Document the contract, not the implementation.** Cover preconditions (e.g. "must be called at `document_start`"), side effects, error/empty-result conditions, and any non-obvious return semantics. Don't restate the parameter types — TypeScript already shows them.
- **Use `@param` / `@returns` only when the type isn't self-explanatory.** Use `@remarks` for design notes, `@example` for non-trivial usage.
- **Internal helpers don't need TSDoc.** If a function isn't exported, a short `//` comment is enough — and only if the why isn't obvious.

## Design system

- **Tokens** in `src/assets/styles/tokens.css` — colors, spacing, radii, pixel shadows, fonts. Every surface imports it first.
- **Surface stylesheets** sit next to it: `popup.css`, `overlay.css`, `options.css`. Classnames are prefix-scoped (`.popup-*` popup, `.ol-*` overlay).
- **Use tokens, not raw values.** No hex or pixel values for shadows/radii on extension surfaces — add a token if one's missing.
- **Wordmark font** (`Bagel Fat One`) is registered at runtime via `installWordmarkFont()` and reserved for the MARU logotype only.
- **Asset URLs in content scripts** must go through `resolveAssetUrl()` so they resolve against the extension origin, not the host page.
