import { useSettings } from "@/storage/use-settings";
import { Switch } from "./Switch";
import { ThresholdInput } from "./ThresholdInput";

/**
 * Behavior preferences (sound, auto-apply, savings threshold). Backed by
 * the persistent {@link useSettings} store so toggles survive reloads
 * and propagate to the content-script overlay.
 */
export function BehaviorSection() {
  const { settings, loaded, update } = useSettings();

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
        <Switch
          checked={settings.sound}
          onChange={(next) => update({ sound: next })}
          label="Sound on big wins"
        />
      </div>
      <div className="settings-row">
        <div className="settings-row-info">
          <div className="settings-row-title">Minimum savings to alert</div>
          <div className="settings-row-desc">
            Don&apos;t bug me unless I&apos;d save at least this much per swap.
          </div>
        </div>
        {loaded && (
          <ThresholdInput
            value={settings.threshold}
            onChange={(next) => update({ threshold: next })}
          />
        )}
      </div>
    </div>
  );
}
