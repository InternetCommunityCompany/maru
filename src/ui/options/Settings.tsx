import { Maru } from "@/ui/mascot/Maru";
import { BehaviorSection } from "./BehaviorSection";
import { ExcludedSites } from "./ExcludedSites";
import { PanelClose } from "./PanelClose";
import { SettingsFooter } from "./SettingsFooter";
import { StatsSection } from "./StatsSection";

/** Props for the {@link Settings} options panel. */
export interface SettingsProps {
  /** Hostname of the tab the user came from — passed to the exclusions UI. */
  currentSite?: string | null;
  /** Close handler. Renders the × button when provided. */
  onClose?: () => void;
}

/**
 * Settings panel: exclusions, behavior, stats. Composed from sub-sections
 * so each concern lives in its own file.
 */
export function Settings({ currentSite, onClose }: SettingsProps) {
  return (
    <div className="settings">
      <div className="settings-head">
        <div className="options-brand">
          <Maru state="idle" size={32} />
          <span className="options-wordmark">MARU</span>
          <span className="options-tagline">Settings</span>
        </div>
        {onClose && <PanelClose onClose={onClose} />}
      </div>
      <ExcludedSites currentSite={currentSite} />
      <BehaviorSection />
      <StatsSection />
      <SettingsFooter />
    </div>
  );
}
