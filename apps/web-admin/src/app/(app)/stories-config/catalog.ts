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
  /** MESITA-4549: the AI bot that checks every real story (MESITA-4535). */
  story_ai_enabled: boolean;
  /** The kill switch: on, a real story is fetched before its bonus; off,
   *  bonuses wait and live Story sales close. */
  story_recheck_meta: boolean;
  story_ai_batch: number;
  story_ai_max_tries: number;
  story_desk_hours: number;
  story_media_retention_hours: number;
  story_stale_days: number;
};

/** The bot's limits as the server clamps them (money_config_merge_story). */
export const BOT_LIMITS = {
  story_ai_batch: { min: 1, max: 50, label: "Stories per run", hint: "Checked every 10 minutes, oldest first." },
  story_ai_max_tries: { min: 1, max: 10, label: "Tries per story", hint: "After this many failed tries the story goes to the desk unread." },
  story_desk_hours: { min: 1, max: 168, label: "Desk time limit (hours)", hint: "An unread or unclear story nobody decides is rejected after this." },
  story_media_retention_hours: { min: 24, max: 720, label: "Keep images (hours)", hint: "After the bonus is decided." },
  story_stale_days: { min: 1, max: 90, label: "Unclaimed story ends after (days)", hint: "A story no voucher took." },
} as const;
export type BotLimitKey = keyof typeof BOT_LIMITS;

export const EMULATOR_BONUS_WAIT = { min: 10, max: 600 } as const;
export const EMULATOR_POST_WINDOW = { min: 60, max: 3600 } as const;

export const DEFAULT_STORIES: StoriesConfig = {
  story_min_followers: STORY_MIN_FOLLOWERS_DEFAULT,
  story_bonus_wait_sec: 3 * 3600,
  story_emulator: false,
  story_emulator_bonus_wait_sec: 30,
  story_emulator_post_window_sec: 120,
  story_ai_enabled: true,
  story_recheck_meta: true,
  story_ai_batch: 20,
  story_ai_max_tries: 3,
  story_desk_hours: 48,
  story_media_retention_hours: 72,
  story_stale_days: 30,
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
    story_ai_enabled: o.story_ai_enabled !== false,
    story_recheck_meta: o.story_recheck_meta === true,
    story_ai_batch: int(o.story_ai_batch, DEFAULT_STORIES.story_ai_batch),
    story_ai_max_tries: int(o.story_ai_max_tries, DEFAULT_STORIES.story_ai_max_tries),
    story_desk_hours: int(o.story_desk_hours, DEFAULT_STORIES.story_desk_hours),
    story_media_retention_hours: int(o.story_media_retention_hours, DEFAULT_STORIES.story_media_retention_hours),
    story_stale_days: int(o.story_stale_days, DEFAULT_STORIES.story_stale_days),
  };
}

/** The bot's keys (MESITA-4549): saved by Stories with the floor. */
export function botPatch(c: StoriesConfig) {
  return {
    story_ai_enabled: c.story_ai_enabled,
    story_recheck_meta: c.story_recheck_meta,
    story_ai_batch: c.story_ai_batch,
    story_ai_max_tries: c.story_ai_max_tries,
    story_desk_hours: c.story_desk_hours,
    story_media_retention_hours: c.story_media_retention_hours,
    story_stale_days: c.story_stale_days,
  };
}

/** Whether the floor or any bot key differs from the saved config. */
export function storiesDirty(saved: StoriesConfig, cfg: StoriesConfig): boolean {
  if (saved.story_min_followers !== cfg.story_min_followers) return true;
  const a = botPatch(saved);
  const b = botPatch(cfg);
  return (Object.keys(a) as Array<keyof typeof a>).some((k) => a[k] !== b[k]);
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
