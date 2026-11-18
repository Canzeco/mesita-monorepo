// One structured log line per Story transition (MESITA-4405): created,
// found, approved, rejected, released, void (+ reason). Ids and the waiter's
// device hash only: never the Instagram handle, the media URL or a token.
// A support question is answered from these lines, and the weekly funnel
// (bought → found → approved → released, per place) is counted from them.

export type StoryEvent = "created" | "found" | "approved" | "rejected" | "released" | "void";

export type StoryLogFields = {
  story_id: string | null | undefined;
  purchase_id?: string | null;
  place_id?: string | null;
  livemode?: boolean | null;
  reason?: string | null;
  device_hash?: string | null;
  via?: string;
};

/** The line itself (story-log.test.ts pins its shape). */
export function storyLogLine(event: StoryEvent, f: StoryLogFields): string {
  const out: Record<string, unknown> = { story_event: event, story_id: f.story_id ?? null };
  for (const k of ["purchase_id", "place_id", "livemode", "reason", "device_hash", "via"] as const) {
    if (f[k] !== undefined && f[k] !== null) out[k] = f[k];
  }
  return JSON.stringify(out);
}

export function storyLog(event: StoryEvent, f: StoryLogFields, log: (l: string) => void = (l) => console.log(l)): void {
  log(`[story] ${storyLogLine(event, f)}`);
}

/** wallet_credit_purchase's answer on a Story: its `created` line. */
export function logCreditStory(purchaseId: string, answer: unknown, via: string): void {
  const a = answer as { outcome?: string; story_id?: string; story?: string } | null;
  if (a?.outcome !== "credited" || !a.story_id) return;
  storyLog("created", { story_id: a.story_id, purchase_id: purchaseId, via });
  if (a.story === "found" || a.story === "approved") storyLog(a.story, { story_id: a.story_id, purchase_id: purchaseId, via: "credit" });
}
