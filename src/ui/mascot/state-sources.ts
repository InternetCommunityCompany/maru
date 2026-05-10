import dancingUrl from "@/assets/maru/dancing.webp";
import findingMoneyUrl from "@/assets/maru/finding-money.webp";
import idleUrl from "@/assets/maru/idle.webp";
import searchingUrl from "@/assets/maru/searching.webp";
import thumbsUpUrl from "@/assets/maru/thumbs-up.webp";
import yawningUrl from "@/assets/maru/yawning.webp";
import { resolveAssetUrl } from "@/assets/resolve-asset-url";
import type { MaruState } from "./types";

/**
 * Map of mascot state → fully-resolved sprite URL.
 *
 * @remarks
 * URLs are wrapped through {@link resolveAssetUrl} so they remain valid
 * inside content scripts (whose document origin is the host page, not the
 * extension).
 */
export const MARU_STATE_SOURCES: Record<MaruState, string> = {
  idle: resolveAssetUrl(idleUrl),
  searching: resolveAssetUrl(searchingUrl),
  "thumbs-up": resolveAssetUrl(thumbsUpUrl),
  yawning: resolveAssetUrl(yawningUrl),
  "finding-money": resolveAssetUrl(findingMoneyUrl),
  dancing: resolveAssetUrl(dancingUrl),
};
