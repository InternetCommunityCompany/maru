/** Props for the {@link PanelClose} button. */
export interface PanelCloseProps {
  /** Click handler. Caller decides whether to close a modal or the tab. */
  onClose: () => void;
}

/**
 * Square × button shown in the top-right of the Settings and History panel
 * headers. Uses the system pixel-shadow + walnut border treatment.
 */
export function PanelClose({ onClose }: PanelCloseProps) {
  return (
    <button className="panel-close" onClick={onClose} aria-label="Close">
      ×
    </button>
  );
}
