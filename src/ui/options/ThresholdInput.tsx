import { useState } from "react";

/** Props for the {@link ThresholdInput} control. */
export interface ThresholdInputProps {
  /** Current threshold in USD. Used to seed the draft on mount only. */
  value: number;
  /** Called with a parsed, finite, non-negative number whenever the
   *  draft becomes a valid value. Invalid drafts (mid-typing, empty,
   *  letters) don't fire this. */
  onChange: (next: number) => void;
}

/**
 * Numeric draft input for the savings-threshold setting. Owns its own
 * draft string so partial values like `"1."` aren't immediately rounded
 * back to `"1.00"` while the user is mid-typing.
 *
 * @remarks
 * Mount this component only after the underlying storage has resolved,
 * so the lazy initial state seeds from the persisted value rather than
 * a default that gets overwritten a tick later.
 */
export function ThresholdInput({ value, onChange }: ThresholdInputProps) {
  const [draft, setDraft] = useState(() => value.toFixed(2));

  const handleChange = (raw: string) => {
    setDraft(raw);
    const parsed = parseFloat(raw);
    if (Number.isFinite(parsed) && parsed >= 0) onChange(parsed);
  };

  return (
    <div className="threshold-input">
      <span>$</span>
      <input
        value={draft}
        onChange={(event) => handleChange(event.target.value)}
        aria-label="Minimum savings threshold in dollars"
      />
    </div>
  );
}
