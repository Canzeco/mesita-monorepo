// THE STORY CHECK BEFORE PAY (MESITA-4296, Pato 2026-11-17: "súbete
// historia, paga, y luego el bono … no puedes borrar la story durante 3
// horas"). The Story sheet asks consumer-web-check-story (through the host's
// onCheckStory) whether the guest's story has reached Mesita, and only then
// offers Pay. This module is the sheet's pure half: the answer's shape, which
// reasons are a GATE (nothing to post: the Post step hides), the words for
// each, and the poll loop that looks for the story while the guest posts.
// No React, no network: the host does the call.

/** The story the check found, as the server shows it. */
export type StoryCheckMention = {
  id: string;
  media_url: string | null;
  media_kind: "image" | "video";
  mentioned_at: string;
  source: "meta" | "emulator";
};

/** Why no story counts yet, in the server's fixed order (_shared/story-check.ts). */
export type StoryCheckReason =
  | "place_no_instagram"
  | "needs_instagram"
  | "few_followers"
  | "private_account"
  | "already_bought"
  | "story_unavailable"
  | "not_available"
  | "no_story"
  | "story_too_old";

/** How often and how long the sheet looks (the server's numbers). */
export type StoryPollWindow = { every_ms: number; for_ms: number };

/** One answer of the check, as the host hands it to the sheet. `failed` is a
 *  500 check_failed or no answer: the sheet keeps looking and never reads it
 *  as no_story. */
export type StoryCheckAnswer =
  | { kind: "found"; mention: StoryCheckMention; placeHandle: string | null; poll: StoryPollWindow }
  | { kind: "missing"; reason: StoryCheckReason; placeHandle: string | null; poll: StoryPollWindow }
  | { kind: "failed" };

export const STORY_POLL_DEFAULT: StoryPollWindow = { every_ms: 5_000, for_ms: 120_000 };

/** The reasons posting cannot fix: the sheet shows only the reason and its
 *  one action, and hides the Post step. The twin of the server's
 *  STORY_GATE_REASONS. */
export type StoryGateReason = Exclude<StoryCheckReason, "no_story" | "story_too_old">;

export const STORY_GATE_REASONS: readonly StoryGateReason[] = [
  "place_no_instagram",
  "needs_instagram",
  "few_followers",
  "private_account",
  "already_bought",
  "story_unavailable",
  "not_available",
];

export function isStoryGateReason(r: StoryCheckReason): r is StoryGateReason {
  return (STORY_GATE_REASONS as readonly StoryCheckReason[]).includes(r);
}

/** What the gate offers to lift it: the host's Instagram page (link or sync
 *  it), or nothing the guest can do here. */
export type StoryGateAction = "link_instagram" | "sync_instagram" | null;

export const STORY_GATE_LINE: Record<StoryGateReason, { text: string; action: StoryGateAction }> = {
  place_no_instagram: { text: "This place hasn't linked its Instagram yet, so Story isn't available here.", action: null },
  needs_instagram: { text: "Link your Instagram to use Story.", action: "link_instagram" },
  few_followers: { text: "Story is for Instagram accounts with more than 1,000 followers.", action: null },
  private_account: { text: "Your Instagram is private. Make it public, then sync it.", action: "sync_instagram" },
  already_bought: { text: "One Story per visit. Pay a bill here by card to get another.", action: null },
  story_unavailable: { text: "Story isn't available right now.", action: null },
  not_available: { text: "This place isn't selling Story right now.", action: null },
};

/** The sheet's step, from the latest answer and whether the look is still on. */
export type StorySheetView =
  | { step: "checking" }
  | { step: "gate"; reason: StoryGateReason; text: string; action: StoryGateAction; showPost: false }
  | { step: "post"; showPost: true; looking: boolean; note: string | null; reason: "no_story" | "story_too_old" | null }
  | { step: "found"; showPost: false; mention: StoryCheckMention };

/** Words once the look ended without a story (MESITA-4296). */
export const STORY_NOT_YET = "We haven't seen it yet. Stories can take a minute to reach us.";
export const STORY_TOO_OLD = "Your story must stay up 3 more hours. Post a new one.";

/** The pure mapping the sheet draws: a gate reason hides Post; no_story and
 *  story_too_old keep it, with their line once the look has ended; a found
 *  story turns Pay on. `last` null: the first check has not answered. */
export function storySheetView(last: StoryCheckAnswer | null, looking: boolean, gateSeen: StoryGateReason | null = null): StorySheetView {
  if (gateSeen) {
    const g = STORY_GATE_LINE[gateSeen];
    return { step: "gate", reason: gateSeen, text: g.text, action: g.action, showPost: false };
  }
  if (last === null) return { step: "checking" };
  if (last.kind === "found") return { step: "found", showPost: false, mention: last.mention };
  if (last.kind === "missing" && isStoryGateReason(last.reason)) {
    const g = STORY_GATE_LINE[last.reason];
    return { step: "gate", reason: last.reason, text: g.text, action: g.action, showPost: false };
  }
  const reason = last.kind === "missing" && (last.reason === "no_story" || last.reason === "story_too_old") ? last.reason : null;
  const note = looking ? null : reason === "story_too_old" ? STORY_TOO_OLD : STORY_NOT_YET;
  return { step: "post", showPost: true, looking, note, reason };
}

/** "posted 4 min ago" (MESITA-4296). */
export function postedAgo(iso: string, now = Date.now()): string {
  const at = Date.parse(iso);
  if (!Number.isFinite(at)) return "";
  const min = Math.max(0, Math.floor((now - at) / 60_000));
  if (min < 1) return "posted just now";
  if (min < 60) return `posted ${min} min ago`;
  const h = Math.floor(min / 60);
  return `posted ${h} h ${min % 60} min ago`;
}

/** The sessionStorage marker that reopens a place's Story sheet at the check
 *  step after a trip to Instagram reloaded the page. */
export function storyMarkerKey(placeId: string): string {
  return `mesita.story-check.${placeId}`;
}

// ── The look (the poll loop) ────────────────────────────────────────────────

type Timer = unknown;

export type StoryPollDeps = {
  /** One poll call (`?poll=1`). */
  check: () => Promise<StoryCheckAnswer>;
  /** Every answer the loop gets, in order. */
  onAnswer: (a: StoryCheckAnswer) => void;
  /** The loop started or stopped looking. */
  onLooking: (looking: boolean) => void;
  now?: () => number;
  setTimer?: (fn: () => void, ms: number) => Timer;
  clearTimer?: (t: Timer) => void;
  /** A burst of focus and visibility events starts one look (ms). */
  debounceMs?: number;
};

export type StoryPoll = {
  /** Start a new look now for the window (the old one, if any, ends). */
  start: (window?: StoryPollWindow) => void;
  /** Start a new look after the debounce: focus and visibilitychange. Does
   *  nothing before the first start (a gate) or after a found story. */
  restart: () => void;
  /** The sheet closed or paid: no answer is reported after this. */
  close: () => void;
  /** A story was found: the look ends and focus no longer wakes it; start() does. */
  found: () => void;
  readonly looking: boolean;
};

/** ONE LOOP AT A TIME: every start ends the previous loop (its answers still
 *  land, its next tick never runs), and a check already in flight is never
 *  doubled: the new loop waits for it. The look stops on a found story, on
 *  close and at the window's end. */
export function createStoryPoll(deps: StoryPollDeps): StoryPoll {
  const now = deps.now ?? (() => Date.now());
  const setTimer = deps.setTimer ?? ((fn: () => void, ms: number) => setTimeout(fn, ms));
  const clearTimer = deps.clearTimer ?? ((t: Timer) => clearTimeout(t as ReturnType<typeof setTimeout>));
  const debounceMs = deps.debounceMs ?? 600;

  let gen = 0;
  let closed = false;
  let looking = false;
  let inFlight = false;
  let waiting = false;
  // Woken by focus only once a look ran (never past a gate) and no story
  // was found since; an explicit start() always runs.
  let armed = false;
  let asleep = false;
  let deadline = 0;
  let every = STORY_POLL_DEFAULT.every_ms;
  let win: StoryPollWindow = STORY_POLL_DEFAULT;
  let tickTimer: Timer | null = null;
  let debounceTimer: Timer | null = null;

  const setLooking = (v: boolean) => {
    if (looking === v) return;
    looking = v;
    deps.onLooking(v);
  };
  const clearTick = () => {
    if (tickTimer !== null) clearTimer(tickTimer);
    tickTimer = null;
  };

  const tick = (mine: number) => {
    if (closed || mine !== gen) return;
    // A check is out: the newer loop waits for it, never doubles it.
    if (inFlight) {
      waiting = true;
      return;
    }
    inFlight = true;
    void deps
      .check()
      .catch((): StoryCheckAnswer => ({ kind: "failed" }))
      .then((a) => {
        inFlight = false;
        const queued = waiting;
        waiting = false;
        if (closed) return;
        deps.onAnswer(a);
        if (a.kind === "found") {
          asleep = true;
          gen++;
          clearTick();
          setLooking(false);
          return;
        }
        if (a.kind !== "failed") every = Math.max(1_000, a.poll.every_ms);
        // A newer loop started while this check was out: its first tick now.
        if (queued && mine !== gen) {
          tick(gen);
          return;
        }
        if (mine !== gen) return;
        if (now() + every > deadline) {
          setLooking(false);
          return;
        }
        tickTimer = setTimer(() => tick(mine), every);
      });
  };

  const start = (w?: StoryPollWindow) => {
    if (closed) return;
    if (w) win = w;
    armed = true;
    asleep = false;
    every = Math.max(1_000, win.every_ms);
    gen++;
    clearTick();
    deadline = now() + win.for_ms;
    setLooking(true);
    tick(gen);
  };

  return {
    start,
    restart: () => {
      if (closed || !armed || asleep) return;
      if (debounceTimer !== null) clearTimer(debounceTimer);
      debounceTimer = setTimer(() => {
        debounceTimer = null;
        start();
      }, debounceMs);
    },
    close: () => {
      closed = true;
      gen++;
      clearTick();
      if (debounceTimer !== null) clearTimer(debounceTimer);
      debounceTimer = null;
      setLooking(false);
    },
    found: () => {
      asleep = true;
      gen++;
      clearTick();
      setLooking(false);
    },
    get looking() {
      return looking;
    },
  };
}
