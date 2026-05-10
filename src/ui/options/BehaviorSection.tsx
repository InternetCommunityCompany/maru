import { useState } from "react";
import { Switch } from "./Switch";

/**
 * Behavior preferences (sound, auto-apply, savings threshold). All state is
 * local for now — wiring through to the engine comes later.
 */
export function BehaviorSection() {
  const [sound, setSound] = useState(true);
  const [autoApply, setAutoApply] = useState(false);
  const [threshold, setThreshold] = useState("1.00");

  return (
    <div className="settings-section">
      <div className="section-heading">Behavior</div>
      <div className="settings-row">
        <div className="settings-row-info">
          <div className="settings-row-title">Sound on big wins</div>
          <div className="settings-row-desc">
            A tiny coin chime when you save more than $5.
          </div>
        </div>
        <Switch checked={sound} onChange={setSound} label="Sound on big wins" />
      </div>
      <div className="settings-row">
        <div className="settings-row-info">
          <div className="settings-row-title">Auto-apply best rate</div>
          <div className="settings-row-desc">
            Skip the nudge — just use the cheapest source. You&apos;ll still confirm in
            your wallet.
          </div>
        </div>
        <Switch checked={autoApply} onChange={setAutoApply} label="Auto-apply best rate" />
      </div>
      <div className="settings-row">
        <div className="settings-row-info">
          <div className="settings-row-title">Minimum savings to alert</div>
          <div className="settings-row-desc">
            Don&apos;t bug me unless I&apos;d save at least this much per swap.
          </div>
        </div>
        <div className="threshold-input">
          <span>$</span>
          <input
            value={threshold}
            onChange={(event) => setThreshold(event.target.value)}
            aria-label="Minimum savings threshold in dollars"
          />
        </div>
      </div>
    </div>
  );
}
