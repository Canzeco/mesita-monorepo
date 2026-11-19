// Admin › Configurations › Stories (MESITA-4425): the shape the `stories`
// section of admin-web-get-config answers, coerced so a missing or odd value
// reads the default rather than crashing the page.

export const STORY_MIN_FOLLOWERS_DEFAULT = 1000;
export const STORY_MIN_FOLLOWERS_MAX = 1_000_000;

export type StoriesConfig = {
  /** Editable: the follower floor for buying a Story voucher. */
  story_min_followers: number;
  /** Read-only here: the real bonus wait after the waiter approves. */
  story_bonus_wait_sec: number;
  /** Read-only here: payment → the deadline to post and be approved. */
  story_post_window_sec: number;
};

export const DEFAULT_STORIES: StoriesConfig = {
  story_min_followers: STORY_MIN_FOLLOWERS_DEFAULT,
  story_bonus_wait_sec: 3 * 3600,
  story_post_window_sec: 12 * 3600,
};

const int = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? Math.trunc(v) : d);

export function coerceStories(raw: unknown): StoriesConfig {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    story_min_followers: int(o.story_min_followers, DEFAULT_STORIES.story_min_followers),
    story_bonus_wait_sec: int(o.story_bonus_wait_sec, DEFAULT_STORIES.story_bonus_wait_sec),
    story_post_window_sec: int(o.story_post_window_sec, DEFAULT_STORIES.story_post_window_sec),
  };
}

/** "3 h", "12 h", "90 min", "30 s": a duration the way the page says it. */
export function formatDuration(sec: number): string {
  if (sec % 3600 === 0) return `${sec / 3600} h`;
  if (sec >= 3600) return `${(sec / 3600).toFixed(1).replace(/\.0$/, "")} h`;
  if (sec % 60 === 0) return `${sec / 60} min`;
  return `${sec} s`;
}

/** Saving a LOWER floor below 1,000 while payments are live opens Story to
 *  real-money guests the old floor kept out, so the page asks first. */
export function needsFloorConfirm(next: number, saved: number, paymentsLive: boolean): boolean {
  return paymentsLive && next < STORY_MIN_FOLLOWERS_DEFAULT && next < saved;
}
