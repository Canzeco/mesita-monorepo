// Admin › Configurations › Stories (MESITA-4425): the shape the `stories`
// section of admin-web-get-config answers, coerced so a missing or odd value
// reads the default rather than crashing the page.

export const STORY_MIN_FOLLOWERS_DEFAULT = 1000;
export const STORY_MIN_FOLLOWERS_MAX = 1_000_000;

export type StoriesConfig = {
  /** Editable: the follower floor for buying a Story voucher. */
  story_min_followers: number;
  /** Read-only here: the real bonus wait after the story is posted. */
  story_bonus_wait_sec: number;
  /** Emulator mode (MESITA-4426): in effect only with test payments and Meta off. */
  story_emulator: boolean;
  /** A test Story's bonus wait from an emulator story, 10–600 s. */
  story_emulator_bonus_wait_sec: number;
  /** A test Story's time to post while the switch is on, 60–3600 s. */
  story_emulator_post_window_sec: number;
};

export const EMULATOR_BONUS_WAIT = { min: 10, max: 600 } as const;
export const EMULATOR_POST_WINDOW = { min: 60, max: 3600 } as const;

export const DEFAULT_STORIES: StoriesConfig = {
  story_min_followers: STORY_MIN_FOLLOWERS_DEFAULT,
  story_bonus_wait_sec: 3 * 3600,
  story_emulator: false,
  story_emulator_bonus_wait_sec: 30,
  story_emulator_post_window_sec: 120,
};

const int = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? Math.trunc(v) : d);

export function coerceStories(raw: unknown): StoriesConfig {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    story_min_followers: int(o.story_min_followers, DEFAULT_STORIES.story_min_followers),
    story_bonus_wait_sec: int(o.story_bonus_wait_sec, DEFAULT_STORIES.story_bonus_wait_sec),
    story_emulator: o.story_emulator === true,
    story_emulator_bonus_wait_sec: int(o.story_emulator_bonus_wait_sec, DEFAULT_STORIES.story_emulator_bonus_wait_sec),
    story_emulator_post_window_sec: int(o.story_emulator_post_window_sec, DEFAULT_STORIES.story_emulator_post_window_sec),
  };
}

/** "3 h", "12 h", "90 min", "30 s": a duration the way the page says it. */
export function formatDuration(sec: number): string {
  if (sec % 3600 === 0) return `${sec / 3600} h`;
  if (sec >= 3600) return `${(sec / 3600).toFixed(1).replace(/\.0$/, "")} h`;
  if (sec % 60 === 0) return `${sec / 60} min`;
  return `${sec} s`;
}

/** What emulator mode does right now, from the same three inputs the server's
 *  effective flag reads: the switch, payments in test mode, Meta off. */
export function emulatorStatus(on: boolean, paymentsLive: boolean, storyMode: string | null): { active: boolean; line: string } {
  if (!on) return { active: false, line: "Off. Story vouchers follow the real rules." };
  if (paymentsLive) return { active: false, line: "Inactive: payments are live." };
  if (storyMode === "meta") return { active: false, line: "Inactive: Meta mention detection is on." };
  return {
    active: true,
    line: "Active: every guest with Instagram can buy Story vouchers, real guests too, while payments are in test mode.",
  };
}

/** Saving a LOWER floor below 1,000 while payments are live opens Story to
 *  real-money guests the old floor kept out, so the page asks first. */
export function needsFloorConfirm(next: number, saved: number, paymentsLive: boolean): boolean {
  return paymentsLive && next < STORY_MIN_FOLLOWERS_DEFAULT && next < saved;
}

/** Stories sends the floor and nothing else, so a save there cannot clobber the emulator. */
export function floorPatch(c: StoriesConfig): { story_min_followers: number } {
  return { story_min_followers: c.story_min_followers };
}

/** Extra › Story sends the emulator keys and nothing else, so a save there cannot clobber the floor. */
export function emulatorPatch(c: StoriesConfig): {
  story_emulator: boolean;
  story_emulator_bonus_wait_sec: number;
  story_emulator_post_window_sec: number;
} {
  return {
    story_emulator: c.story_emulator,
    story_emulator_bonus_wait_sec: c.story_emulator_bonus_wait_sec,
    story_emulator_post_window_sec: c.story_emulator_post_window_sec,
  };
}
