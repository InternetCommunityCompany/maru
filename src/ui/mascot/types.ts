/**
 * The six discrete animation states the Maru mascot can render. Each maps 1:1
 * to a webp sprite in {@link MARU_STATE_SOURCES}.
 *
 * @remarks
 * - `idle`          — calm breathing, gentle bounce
 * - `searching`     — head swivels, looking for something
 * - `thumbs-up`     — approval ("good rate!")
 * - `yawning`       — sleepy / waiting / paused
 * - `finding-money` — signature "aha!" moment when a better rate is found
 * - `dancing`       — celebration / success
 */
export type MaruState =
  | "idle"
  | "searching"
  | "thumbs-up"
  | "yawning"
  | "finding-money"
  | "dancing";
