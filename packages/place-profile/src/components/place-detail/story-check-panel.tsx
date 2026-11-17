"use client";

// THE STORY CHECK ON THE OFFERS SHEET (MESITA-4297, Pato 2026-11-17: "your
// story gets verified by waiter, and then you pay. then receive instant
// principal. don't delete story for 3 hours and in 3 hours you receive your
// bonus"). The Story sheet opens the guest's check (the host's
// openStoryCheck), shows its QR while the waiter has to see the story, and
// lets Pay through only once the waiter approved it. It re-reads every 5 s
// while the check is open, whenever the page is visible again (the guest
// went to Instagram and back), at the pay-by time and right before Pay.

import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import type { PlaceActions, StoryCheck, StoryCheckRead } from "../../actions";
import { cn } from "../../lib/format";

/** The Offers sheet polls an open check this often. */
export const STORY_POLL_MS = 5_000;
/** After this many failed reads in a row the panel offers Retry. */
const MAX_FAILURES = 3;
/** Waiting this long with no story, the panel hints at the tag. */
const HINT_AFTER_MS = 2 * 60_000;

export type StoryCheckState = {
  /** The last good read, or null before the first answer. */
  read: StoryCheckRead | null;
  /** Reads failed in a row since the last good one. */
  failures: number;
  /** When the check was first seen waiting for a story. */
  waitingSince: number | null;
  refresh: () => Promise<StoryCheckRead | null>;
  emulating: "post" | "delete" | null;
  emulate: (action: "post" | "delete") => Promise<void>;
};

/** Which of the Story sheet's steps is current (0 the requirement, 1 post,
 *  2 show the QR, 3 pay, 4 the bonus): the one place the check's states map to
 *  the steps. */
export function storyStepIndex(check: StoryCheck | null): number {
  if (!check) return 1;
  if (check.state === "approved") return 3;
  if (check.state === "used") return 4;
  if (check.state === "expired") return check.story ? 2 : 1;
  if (!check.story || check.story_status !== "received") return 1;
  return 2;
}

/** Pay may run: the waiter approved and the pay-by time has not passed. */
export function storyApproved(check: StoryCheck | null | undefined, now = Date.now()): boolean {
  return check?.state === "approved" && Date.parse(check.expires_at) > now;
}

/** "6:40 pm" — the pay-by and approval times, read in the guest's clock. */
function clock(iso: string | null): string {
  if (!iso) return "";
  const at = new Date(iso);
  return Number.isNaN(at.getTime()) ? "" : at.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }).toLowerCase();
}

function hours(sec: number): string {
  const h = sec / 3600;
  return Number.isInteger(h) ? `${h} hour${h === 1 ? "" : "s"}` : `${Math.round(sec / 60)} minutes`;
}

export function useStoryCheck(actions: PlaceActions | undefined, enabled: boolean): StoryCheckState {
  const [read, setRead] = useState<StoryCheckRead | null>(null);
  const [failures, setFailures] = useState(0);
  const [waitingSince, setWaitingSince] = useState<number | null>(null);
  const [emulating, setEmulating] = useState<"post" | "delete" | null>(null);
  const alive = useRef(true);
  const opened = useRef(false);
  // The host rebuilds its actions every render: read them through a ref so
  // the timers below do not restart on each one.
  const acts = useRef(actions);
  useEffect(() => {
    acts.current = actions;
  }, [actions]);

  const take = useCallback((r: StoryCheckRead | null) => {
    if (!alive.current || !r) return;
    if (!r.ok && r.code === "network") {
      setFailures((n) => n + 1);
      return;
    }
    setFailures(0);
    setRead(r);
    const waiting = r.ok && r.check?.state === "open" && !r.check.story;
    setWaitingSince((at) => (waiting ? at ?? Date.now() : null));
  }, []);

  const refresh = useCallback(async () => {
    const a = acts.current;
    const fn = opened.current ? a?.getStoryCheck : a?.openStoryCheck;
    if (!fn) return null;
    const r = await fn().catch(() => ({ ok: false as const, code: "network", error: "Can't reach Mesita", minFollowers: null }));
    if (r.ok) opened.current = true;
    take(r);
    return r;
  }, [take]);

  // Open the check when the sheet opens (the QR exists from then on).
  useEffect(() => {
    alive.current = true;
    if (enabled) void refresh();
    return () => {
      alive.current = false;
    };
  }, [enabled, refresh]);

  const check = read?.ok ? read.check : null;
  const state = check?.state ?? null;

  // Poll while the check waits for the story or the waiter.
  useEffect(() => {
    if (!enabled || state !== "open") return;
    const id = setInterval(() => void refresh(), STORY_POLL_MS);
    return () => clearInterval(id);
  }, [enabled, state, refresh]);

  // Back from Instagram (every state), and once at the pay-by time.
  useEffect(() => {
    if (!enabled) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (check && (check.state === "open" || check.state === "approved")) {
      const wait = Date.parse(check.expires_at) - Date.now();
      if (Number.isFinite(wait) && wait > 0 && wait < 2 ** 31 - 1) timer = setTimeout(() => void refresh(), wait + 500);
    }
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      if (timer) clearTimeout(timer);
    };
  }, [enabled, check, refresh]);

  const emulate = useCallback(async (action: "post" | "delete") => {
    const run = acts.current?.emulateStory;
    if (!run) return;
    setEmulating(action);
    try {
      if (await run(action)) await refresh();
    } finally {
      if (alive.current) setEmulating(null);
    }
  }, [refresh]);

  return { read, failures, waitingSince, refresh, emulating, emulate };
}

/** The live part of the Story sheet: the QR while the waiter has to see the
 *  story, where it stands, and the test band. Nothing when the host gives no
 *  check (web-business). */
export function StoryCheckPanel({
  s,
  renderQr,
  placeHandle,
  canEmulate,
  onLinkInstagram,
}: {
  s: StoryCheckState;
  renderQr?: (url: string) => ReactNode;
  placeHandle: string | null;
  canEmulate: boolean;
  onLinkInstagram?: () => void;
}) {
  const { read, failures } = s;
  // Re-render once a minute for the "no story yet" hint.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  if (!read) {
    // THE FIRST READ: the QR's footprint, so the sheet does not jump.
    return <div className="bg-muted mx-auto h-[236px] w-[236px] animate-pulse rounded-2xl" aria-label="Loading your Story QR" data-story-check="loading" />;
  }

  if (!read.ok) {
    const { code, error, minFollowers } = read;
    const text = code === "needs_instagram"
      ? "Connect your Instagram to use Story"
      : code === "few_followers"
        ? `Story needs more than ${(minFollowers ?? 1000).toLocaleString("en-US")} followers`
        : code === "story_unavailable"
          ? "Story isn't available here right now"
          : error;
    return (
      <div className="flex flex-col gap-3" data-story-check={code}>
        <p className="rounded-xl bg-amber-50 px-3 py-2.5 text-[15px] leading-snug font-semibold text-amber-900">{text}</p>
        {code === "needs_instagram" && onLinkInstagram ? (
          <button type="button" onClick={onLinkInstagram} className="bg-foreground text-paper h-12 w-full rounded-xl text-base font-semibold">
            Connect Instagram
          </button>
        ) : null}
      </div>
    );
  }

  const check = read.ok ? read.check : null;
  if (!check) return null;
  const tag = `@mesita and ${placeHandle ? `@${placeHandle}` : "the place"}`;
  const offline = failures >= MAX_FAILURES;
  const showQr = check.state === "open" && check.story_status === "received";
  const rejected = check.state === "open" && check.last_rejected_at !== null && check.story_status !== "waiting";

  let line: string;
  let tone: "plain" | "good" | "warn" = "plain";
  if (check.state === "approved") {
    line = `Approved at ${clock(check.approved_at)} · pay by ${clock(check.expires_at)}`;
    tone = "good";
  } else if (check.state === "used") {
    line = "Used for your last Story voucher. Post a new story for another.";
  } else if (check.state === "expired") {
    line = check.story ? "Approval expired. Show your QR again." : "This Story QR expired. Close and open Story again.";
    tone = "warn";
  } else if (check.story_status === "too_old") {
    line = "This story is too old for the bonus. Post a new one.";
    tone = "warn";
  } else if (rejected) {
    line = `Not approved. Check: ${tag} tagged, Paid partnership on.`;
    tone = "warn";
  } else if (check.story_status === "received") {
    line = "Story received · show this QR to the staff";
  } else {
    line = "Waiting for your story";
  }
  const hint = check.state === "open" && check.story_status === "waiting" && s.waitingSince !== null && now - s.waitingSince > HINT_AFTER_MS;

  return (
    <div className="flex flex-col items-center gap-3 text-center" data-story-check={check.state} aria-live="polite">
      {showQr && renderQr ? (
        // THE QR LEADS WHILE THE WAITER IS THERE: the largest thing on the
        // sheet, at least 220 px, with a link for a phone without a camera.
        <div className="flex flex-col items-center gap-1.5" data-story-qr>
          <div className="rounded-2xl bg-white p-3">{renderQr(check.url)}</div>
          <a href={check.url} target="_blank" rel="noreferrer" className="text-muted-foreground text-sm underline underline-offset-2">
            Open link
          </a>
        </div>
      ) : null}
      <p
        className={cn(
          "text-[15px] leading-snug font-semibold",
          tone === "good" ? "text-[#00A85A]" : tone === "warn" ? "text-amber-800" : "text-foreground",
        )}
        data-story-line
      >
        {line}
      </p>
      {check.state === "approved" ? (
        <p className="text-muted-foreground text-sm leading-snug">
          Don&apos;t delete your story: the bonus checks it {hours(check.limits.bonus_wait_sec)} after you pay.
        </p>
      ) : null}
      {hint ? (
        <p className="text-muted-foreground text-sm leading-snug">Stories can take a minute to arrive. Make sure you tagged @mesita.</p>
      ) : null}
      {offline ? (
        <p className="text-muted-foreground flex items-center gap-2 text-sm" role="alert">
          Can&apos;t reach Mesita
          <button type="button" onClick={() => void s.refresh()} className="text-foreground min-h-11 font-semibold underline underline-offset-2">
            Retry
          </button>
        </p>
      ) : null}
      {canEmulate && check.test_mode && (check.state === "open" || check.state === "approved") ? (
        // THE TEST BAND (MESITA-4264): under the main content, never the
        // primary button; only in test mode with Instagram not connected.
        <div className="border-border flex w-full flex-col items-center gap-1 rounded-2xl border border-dashed p-2" data-story-emulator>
          {check.story ? (
            <button
              type="button"
              disabled={s.emulating !== null}
              onClick={() => void s.emulate("delete")}
              className="text-muted-foreground min-h-11 px-3 text-sm font-semibold underline disabled:opacity-60"
              data-story-simulate="delete"
            >
              {s.emulating === "delete" ? "Deleting…" : "Simulate deleting the story (test)"}
            </button>
          ) : (
            <button
              type="button"
              disabled={s.emulating !== null}
              onClick={() => void s.emulate("post")}
              className="text-muted-foreground min-h-11 px-3 text-sm font-semibold underline disabled:opacity-60"
              data-story-simulate="post"
            >
              {s.emulating === "post" ? "Posting…" : "Simulate story (test)"}
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
