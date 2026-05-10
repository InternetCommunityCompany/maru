/** Props for the {@link Switch} toggle. */
export interface SwitchProps {
  /** Whether the switch is currently on. */
  checked: boolean;
  /** Toggle handler — called with the new state. */
  onChange: (next: boolean) => void;
  /** Accessible label describing what the switch controls. */
  label: string;
}

/**
 * Inline binary toggle used in settings rows. Pure visual styling lives in
 * `options.css` under `.switch` / `.switch.on`.
 */
export function Switch({ checked, onChange, label }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={"switch " + (checked ? "on" : "")}
      onClick={() => onChange(!checked)}
    />
  );
}
