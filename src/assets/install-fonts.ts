import bagelFontUrl from "@/assets/fonts/BagelFatOne-Regular.ttf";
import jetBrainsMonoUrl from "@/assets/fonts/JetBrainsMono.ttf";
import nunitoUrl from "@/assets/fonts/Nunito.ttf";
import { resolveAssetUrl } from "./resolve-asset-url";

const STYLE_ID = "maru-fonts";

/**
 * Register every MARU font face against the host document.
 *
 * @remarks
 * Defining `@font-face` directly in `tokens.css` would force Vite to
 * base64-inline the (>2 MB) ttf binaries into the bundled stylesheet for
 * content scripts — bloating the overlay payload. Instead we inject the
 * rules at runtime against `document.head` with `chrome-extension://…`
 * URLs, which works on extension pages and is inherited into shadow
 * roots (per WXT's shadow-root style isolation contract).
 *
 * Nunito and JetBrains Mono ship as variable fonts — one file covers
 * the full weight range advertised by the type scale.
 *
 * Idempotent — safe to call from every entrypoint's bootstrap.
 */
export function installFonts(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
@font-face {
  font-family: "Bagel Fat One";
  src: url("${resolveAssetUrl(bagelFontUrl)}") format("truetype");
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: "Nunito";
  src: url("${resolveAssetUrl(nunitoUrl)}") format("truetype");
  font-weight: 100 900;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: "JetBrains Mono";
  src: url("${resolveAssetUrl(jetBrainsMonoUrl)}") format("truetype");
  font-weight: 100 800;
  font-style: normal;
  font-display: swap;
}`;
  document.head.appendChild(style);
}
