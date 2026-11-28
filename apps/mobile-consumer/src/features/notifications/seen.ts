import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { plain } from "@/lib/storage";

import { listNotices, type Notice } from "./api";

// THE BAR'S RED BUBBLE COUNTS WHAT THIS DEVICE HAS NOT SHOWN (the web's
// use-unseen-notifications.ts and lib/notifications-seen.ts): a notice newer
// than the newest one Notifications last showed. Opening Notifications clears
// it. Nothing shown yet: every notice counts.

const KEY = "mesita.notifications-seen-at";
const seenKey = ["notices-seen-at"] as const;

/** Is `at` later than what was seen? Nothing seen yet: yes. */
export function isUnseen(at: string, seenAt: string | null): boolean {
  const n = Date.parse(at);
  if (!Number.isFinite(n)) return false;
  const s = seenAt ? Date.parse(seenAt) : Number.NaN;
  return !Number.isFinite(s) || n > s;
}

export function useUnseenCount(enabled: boolean): number {
  const notices = useQuery({ queryKey: ["notices"], queryFn: ({ signal }) => listNotices(signal), enabled });
  const seen = useQuery({ queryKey: seenKey, queryFn: () => plain.get(KEY), enabled });
  if (!enabled || !notices.data || seen.isPending) return 0;
  return notices.data.filter((row) => isUnseen(row.when, seen.data ?? null)).length;
}

/** Notifications calls this once its list is on screen. */
export function useMarkSeen(rows: readonly Notice[] | undefined): void {
  const client = useQueryClient();
  const newest = rows?.reduce<string | null>((max, row) => (max === null || row.when > max ? row.when : max), null) ?? null;
  useEffect(() => {
    if (!newest) return;
    // Never move the mark backwards (the web's notifications-seen.ts).
    const seen = client.getQueryData<string | null>(seenKey);
    if (seen && !isUnseen(newest, seen)) return;
    void plain.set(KEY, newest).then(() => client.setQueryData(seenKey, newest));
  }, [client, newest]);
}
