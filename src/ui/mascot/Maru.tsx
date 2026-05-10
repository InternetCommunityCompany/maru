import type { CSSProperties } from "react";
import { cx } from "@/ui/cx";
import { MARU_STATE_SOURCES } from "./state-sources";
import type { MaruState } from "./types";

/** Native pixel ratio of every Maru sprite (141 wide × 77 tall). */
const SOURCE_RATIO = 141 / 77;

/** Props for the {@link Maru} mascot component. */
export interface MaruProps {
  /** Animation state to render. Defaults to `"idle"`. */
  state?: MaruState;
  /**
   * Target height in pixels. Source aspect ratio (≈ 1.83:1) is preserved so
   * width is derived automatically.
   */
  size?: number;
  /** When true (default), apply `image-rendering: pixelated` for crisp edges. */
  pixel?: boolean;
  /** Accessible label. Defaults to a humanised version of `state`. */
  alt?: string;
  className?: string;
  style?: CSSProperties;
}

/**
 * Pixel-art tanuki mascot. Renders the WEBP sprite for the requested state,
 * sized by height with the native aspect ratio preserved.
 *
 * @example
 * <Maru state="finding-money" size={48} />
 */
export function Maru({
  state = "idle",
  size = 96,
  pixel = true,
  alt,
  className,
  style,
}: MaruProps) {
  const height = size;
  const width = Math.round(size * SOURCE_RATIO);
  const src = MARU_STATE_SOURCES[state];
  const label = alt ?? `Maru — ${state.replace("-", " ")}`;

  return (
    <img
      src={src}
      alt={label}
      width={width}
      height={height}
      draggable={false}
      className={cx(className, pixel && "pixelated")}
      style={{ display: "block", userSelect: "none", ...style }}
    />
  );
}
