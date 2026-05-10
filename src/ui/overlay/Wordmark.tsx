import { Maru } from "@/ui/mascot/Maru";

/** Props for the {@link Wordmark} brand mark used inside overlay headers. */
export interface WordmarkProps {
  /** When true, render the smaller variant used for compact pills. */
  small?: boolean;
}

/**
 * Brand mark used on every overlay card: a Maru sprite next to the
 * "MARU" logotype. Two sizes are supported via the `small` flag.
 */
export function Wordmark({ small }: WordmarkProps) {
  return (
    <div className={"ol-wordmark" + (small ? " sm" : "")}>
      <Maru state="idle" size={small ? 24 : 32} />
      <span className="ol-wordmark-text">MARU</span>
    </div>
  );
}
