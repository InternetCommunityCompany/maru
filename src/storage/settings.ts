/**
 * Persistent behaviour preferences shown in the Settings → Behavior
 * section. Stored as one object so the section reads/writes with a single
 * round-trip and a single watcher.
 *
 * @remarks
 * Adding a new field is safe without a versioned migration as long as the
 * default for that field is filled in at read-time
 * ({@link SETTINGS_DEFAULTS} merged inside `useSettings`). Renaming or
 * changing the type of an existing field requires bumping `version` and
 * supplying a migration.
 */
export interface Settings {
  /** Play a coin chime when savings on a single swap exceed $5. */
  sound: boolean;
  /** Minimum savings (USD) required before MARU surfaces a better-rate alert. */
  threshold: number;
}

/**
 * Defaults applied both as the storage `fallback` (when nothing's been
 * written yet) and as a shallow-merge base in the consuming hook (so a
 * partial object from an older schema fills missing fields).
 */
export const SETTINGS_DEFAULTS: Settings = {
  sound: true,
  threshold: 1,
};

export const settings = storage.defineItem<Settings>(
  "local:settings",
  { fallback: SETTINGS_DEFAULTS },
);
