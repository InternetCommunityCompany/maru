# MARU

Browser extension that surfaces a better swap quotes.

## Development

```sh
bun install
bun run dev          # Chrome dev server
bun run dev:firefox  # Firefox
bun run test         # vitest
bun run compile      # tsc --noEmit
bun run build        # production build
```

The dev build points the backend at `http://localhost:3000`; the production build points at `https://api.usemaru.com`.
