/** Props for the {@link MasterToggle} component. */
export interface MasterToggleProps {
  /** Hostname of the dapp the popup is currently anchored to. */
  site: string;
  /** Whether MARU is currently active on the given site. */
  enabled: boolean;
  /** Toggle handler — called with the new enabled state. */
  onToggle: (next: boolean) => void;
}

/**
 * Per-site enable/disable strip — the "Pause on this site" control. The
 * label and description shift wording based on the toggle so the row reads
 * correctly in either state.
 */
export function MasterToggle({ site, enabled, onToggle }: MasterToggleProps) {
  return (
    <div className="popup-master">
      <div>
        <div className="popup-master-label">
          {enabled ? "On" : "Paused"} for <span className="popup-site">{site}</span>
        </div>
        <div className="popup-master-desc">
          {enabled
            ? "Watching this site. Toggle off to pause here only."
            : "MARU's quiet on this site. Other dapps still get checked."}
        </div>
      </div>
      <button
        type="button"
        className={"popup-toggle " + (enabled ? "on" : "off")}
        onClick={() => onToggle(!enabled)}
        aria-pressed={enabled}
        aria-label={`MARU ${enabled ? "on" : "paused"} for ${site}`}
      >
        <span className="popup-toggle-thumb" />
      </button>
    </div>
  );
}
