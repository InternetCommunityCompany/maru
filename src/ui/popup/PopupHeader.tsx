import { Maru } from "@/ui/mascot/Maru";
import type { MaruState } from "@/ui/mascot/types";

/** Props for the {@link PopupHeader} component. */
export interface PopupHeaderProps {
  /** Mascot state to render inside the brand mark. */
  mascot: MaruState;
  /** Open-settings handler invoked by the gear icon. */
  onOpenSettings: () => void;
  /** Close-popup handler invoked by the × icon. */
  onClose: () => void;
}

/**
 * Top header strip of the toolbar popup: brand mark + tagline on the left,
 * settings/close icons on the right.
 */
export function PopupHeader({ mascot, onOpenSettings, onClose }: PopupHeaderProps) {
  return (
    <div className="popup-header">
      <div className="popup-brand">
        <Maru state={mascot} size={36} />
        <div>
          <div className="popup-wordmark">MARU</div>
          <div className="popup-tagline">Best swap rates, automatically.</div>
        </div>
      </div>
      <div className="popup-actions">
        <button title="Settings" onClick={onOpenSettings}>
          ⚙
        </button>
        <button title="Close" onClick={onClose}>
          ×
        </button>
      </div>
    </div>
  );
}
