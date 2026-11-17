"use client";

import { useEffect, useState } from "react";
import type { WaitingStory } from "@/lib/api/wallet";

/** The clock a Story line reads (MESITA-4264; MESITA-4296): now, moved on
 *  every minute while a bonus time is still ahead, so "2 h 14 min left"
 *  counts down and turns to "Checking your story now…" without a tap. */
export function useStoryNow(stories: Pick<WaitingStory, "bonus_at">[]): number {
  const [now, setNow] = useState(() => Date.now());
  const key = stories.map((s) => s.bonus_at ?? "").join("|");
  useEffect(() => {
    const t0 = Date.now();
    const ahead = key
      .split("|")
      .map((iso) => (iso ? Date.parse(iso) : NaN))
      .filter((t) => Number.isFinite(t) && t > t0);
    if (ahead.length === 0) return;
    // The next whole minute, or the soonest bonus time if that comes first.
    const nextMinute = 60_000 - (t0 % 60_000);
    const id = setTimeout(() => setNow(Date.now()), Math.min(nextMinute, Math.min(...ahead) - t0) + 500);
    return () => clearTimeout(id);
  }, [key, now]);
  return now;
}

// A RELEASED BONUS IS "NEW" ONCE (MESITA-4296): the first Wallet read that
// shows it highlights it; later visits don't. Kept per device; this session
// keeps the highlight it already showed. Storage can throw (private mode):
// then it shows each visit.
const SEEN_KEY = "mesita.story-bonus-seen.";
const shownNow = new Set<string>();

function seenBefore(id: string): boolean {
  try {
    return window.localStorage.getItem(SEEN_KEY + id) === "1";
  } catch {
    return false;
  }
}

/** The released Story bonus is new to this guest: highlight it this once. */
export function useStoryNew(s: Pick<WaitingStory, "purchase_id" | "state">): boolean {
  const released = s.state === "released";
  const isNew = released && typeof window !== "undefined" && (shownNow.has(s.purchase_id) || !seenBefore(s.purchase_id));
  useEffect(() => {
    if (!isNew) return;
    shownNow.add(s.purchase_id);
    try {
      window.localStorage.setItem(SEEN_KEY + s.purchase_id, "1");
    } catch {
      // shown again next visit
    }
  }, [isNew, s.purchase_id]);
  return isNew;
}
