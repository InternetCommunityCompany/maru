/** Props for the {@link PopupFooter} component. */
export interface PopupFooterProps {
  /** Open the history view (in the options page). */
  onOpenHistory: () => void;
  /** Open the settings view (in the options page). */
  onOpenSettings: () => void;
  /** Open the help link (currently a no-op stub). */
  onOpenHelp: () => void;
}

/**
 * Bottom action strip of the popup with three uppercase links:
 * History, Excluded sites (jumps to settings), and Help.
 */
export function PopupFooter({ onOpenHistory, onOpenSettings, onOpenHelp }: PopupFooterProps) {
  return (
    <div className="popup-footer">
      <button className="popup-link" onClick={onOpenHistory}>
        <span>📜</span>
        <span>History</span>
      </button>
      <button className="popup-link" onClick={onOpenSettings}>
        <span>⚙</span>
        <span>Excluded sites</span>
      </button>
      <button className="popup-link" onClick={onOpenHelp}>
        <span>💬</span>
        <span>Help</span>
      </button>
    </div>
  );
}
