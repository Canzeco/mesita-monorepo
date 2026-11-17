"use client";

import { useEffect, useState } from "react";
import type { WaitingStory } from "@/lib/api/wallet";

/** The clock a Story line reads (MESITA-4264): now, moved on once at the
 *  soonest bonus time still ahead, so "Approved · bonus from 17:05" turns
 *  to "Checking your story…" without a tap. */
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
    const id = setTimeout(() => setNow(Date.now()), Math.min(...ahead) - t0 + 500);
    return () => clearTimeout(id);
  }, [key, now]);
  return now;
}
