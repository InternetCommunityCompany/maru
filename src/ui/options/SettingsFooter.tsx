/**
 * Bottom strip of the Settings panel: version stamp + Help / Privacy
 * buttons. Buttons are stubbed for now.
 */
export function SettingsFooter() {
  return (
    <div className="settings-section settings-footer-row">
      <div>
        <div className="settings-footer-version">MARU v1.4.2</div>
        <div className="settings-footer-tag">Non-custodial · runs in your browser</div>
      </div>
      <div className="settings-footer-buttons">
        <button className="cta cream cta-sm">Help</button>
        <button className="cta cta-sm">Privacy</button>
      </div>
    </div>
  );
}
