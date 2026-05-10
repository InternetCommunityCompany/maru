import type { CSSProperties } from "react";
import { MARU_SOURCE_RATIO, MARU_STATE_SOURCES } from "./sources";
import type { MaruState } from "./types";

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
  const width = Math.round(size * MARU_SOURCE_RATIO);
  const src = MARU_STATE_SOURCES[state];
  const label = alt ?? `Maru — ${state.replace("-", " ")}`;

  return (
    <img
      src={src}
      alt={label}
      width={width}
      height={height}
      draggable={false}
      className={(className ? className + " " : "") + (pixel ? "pixelated" : "")}
      style={{
        display: "block",
        userSelect: "none",
        imageRendering: pixel ? "pixelated" : "auto",
        ...style,
      }}
    />
  );
}
