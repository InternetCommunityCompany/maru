import bagelFontUrl from "@/assets/fonts/BagelFatOne-Regular.ttf";
import { resolveAssetUrl } from "./resolve-asset-url";

const STYLE_ID = "maru-wordmark-font";

/**
 * Register the `Bagel Fat One` font face against the host document.
 *
 * @remarks
 * Defining `@font-face` directly in `tokens.css` would force Vite to
 * base64-inline the (1.5 MB) ttf into the bundled stylesheet for content
 * scripts — bloating the overlay payload. Instead we inject the rule at
 * runtime against `document.head` with a `chrome-extension://…` URL, which
 * works on extension pages and is inherited into shadow roots (per WXT's
 * shadow-root style isolation contract).
 *
 * Idempotent — safe to call from every entrypoint's bootstrap.
 */
export function installWordmarkFont(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `@font-face {
  font-family: "Bagel Fat One";
  src: url("${resolveAssetUrl(bagelFontUrl)}") format("truetype");
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}`;
  document.head.appendChild(style);
}
