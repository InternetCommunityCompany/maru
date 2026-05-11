interface FontSpec {
  family: string;
  path: "/fonts/BagelFatOne-Regular.ttf" | "/fonts/Nunito.ttf" | "/fonts/JetBrainsMono.ttf";
  weight: string;
}

const FONTS: readonly FontSpec[] = [
  { family: "Bagel Fat One", path: "/fonts/BagelFatOne-Regular.ttf", weight: "400" },
  { family: "Nunito", path: "/fonts/Nunito.ttf", weight: "100 900" },
  { family: "JetBrains Mono", path: "/fonts/JetBrainsMono.ttf", weight: "100 800" },
];

const FLAG = "__maruFontsLoaded";

/**
 * Register every MARU font face against the host document.
 *
 * @remarks
 * Fonts are loaded with `fetch()` and registered through the
 * {@link FontFace} JS API — never via `@font-face url()`. A CSS-based
 * load would be subject to the host page's `font-src` CSP, which on
 * strict sites (1inch, defi dashboards) blocks `chrome-extension://`
 * URLs and breaks the overlay's wordmark. The JS API loads from raw
 * binary data, which the extension's `fetch` privilege grants
 * regardless of page CSP.
 *
 * Fonts added to `document.fonts` are visible to descendant shadow
 * roots, so a single registration covers every overlay surface.
 *
 * Idempotent — safe to call from every entrypoint's bootstrap.
 */
export async function installFonts(): Promise<void> {
  const doc = document as Document & { [FLAG]?: boolean };
  if (doc[FLAG]) return;
  doc[FLAG] = true;

  await Promise.all(
    FONTS.map(async ({ family, path, weight }) => {
      const url = browser.runtime.getURL(path);
      const data = await (await fetch(url)).arrayBuffer();
      const face = new FontFace(family, data, { weight, style: "normal", display: "swap" });
      await face.load();
      document.fonts.add(face);
    }),
  );
}
