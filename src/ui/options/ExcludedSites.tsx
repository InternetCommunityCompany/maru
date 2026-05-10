import { useState } from "react";
import { normaliseSite } from "@/storage/excluded-sites";
import { useExcludedSites } from "@/storage/use-excluded-sites";

/** Props for the {@link ExcludedSites} settings section. */
export interface ExcludedSitesProps {
  /** Hostname of the tab the user opened the options page from. */
  currentSite?: string | null;
}

/**
 * Excluded-sites manager. Lists every site MARU is paused on, removes
 * entries, accepts a new domain via input, and offers a one-click "Pause on
 * {currentSite}" shortcut when the user isn't already excluding it.
 */
export function ExcludedSites({ currentSite }: ExcludedSitesProps) {
  const { sites, add, remove } = useExcludedSites();
  const [input, setInput] = useState("");

  const handleAdd = () => {
    const next = normaliseSite(input);
    if (!next) return;
    add(next);
    setInput("");
  };

  const onCurrent = currentSite ? sites.includes(currentSite) : false;

  return (
    <div className="settings-section">
      <div className="section-heading">Excluded sites · {sites.length}</div>
      <div className="section-subtitle">
        MARU runs on every dapp <em>except</em> these. Add a site here when you want full
        manual control on it.
      </div>

      <div className="excl-list">
        {sites.length === 0 ? (
          <div className="excl-empty">
            No exclusions yet. MARU&apos;s watching everywhere.
          </div>
        ) : (
          sites.map((site) => (
            <div key={site} className="excl-row">
              <div className="excl-name">
                <span className="excl-favicon">{site[0]?.toUpperCase() ?? "?"}</span>
                <span>{site}</span>
                {site === currentSite && <span className="excl-badge">current site</span>}
              </div>
              <button
                className="excl-remove"
                onClick={() => remove(site)}
                aria-label={`Remove ${site}`}
                title="Remove"
              >
                ×
              </button>
            </div>
          ))
        )}
      </div>

      <div className="excl-add">
        <input
          placeholder="domain.com"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") handleAdd();
          }}
        />
        <button className="cta cream cta-sm" onClick={handleAdd}>
          Add
        </button>
        {currentSite && !onCurrent && (
          <button className="cta cta-sm" onClick={() => add(currentSite)}>
            Pause on {currentSite}
          </button>
        )}
      </div>
    </div>
  );
}
