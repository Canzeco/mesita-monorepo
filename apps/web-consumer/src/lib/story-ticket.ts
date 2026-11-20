// THE STORY TICKET'S WORDS (MESITA-4484): what the Story screen and the
// Tickets › Stories row say. Pay is already credit. The story ticket is a
// later row: post tagging @mesita and the restaurant, keep it up, the bonus
// lands by itself. There is no post deadline and no waiter. Times read in
// the place's own zone. A PLAIN MODULE: no React.

import { money, type StoryTicket } from "@/lib/api/wallet";
import { storyClock, storyLeft } from "@/lib/story-lines";

export type StoryTone = "green" | "ink" | "grey";

const zoneOf = (s: Pick<StoryTicket, "time_zone">) => s.time_zone ?? "America/Mexico_City";

/** The bonus, "+$50.00MX". */
export function storyBonus(s: Pick<StoryTicket, "bonus_cents" | "currency">): string {
  return `+${money(s.bonus_cents, s.currency ?? "mxn")}`;
}

/** A story ticket has no post deadline (MESITA-4484). */
export function storyLate(_s: Pick<StoryTicket, "state" | "deadline_at">, _now = Date.now()): boolean {
  return false;
}

/** The state chip: one word or two, in its tone. */
export function storyStatus(s: StoryTicket, now = Date.now()): { label: string; tone: StoryTone } {
  if (storyLate(s, now)) return { label: "Time's up", tone: "grey" };
  switch (s.state) {
    case "waiting_post":
      return { label: "Post your story", tone: "ink" };
    case "found":
      return { label: "Story found", tone: "ink" };
    case "approved":
      return { label: s.bonus_at ? `Checking · bonus at ${storyClock(s.bonus_at, zoneOf(s), now)}` : "Checking", tone: "ink" };
    case "released":
      return { label: "Bonus added", tone: "green" };
    default:
      return { label: "No bonus", tone: "grey" };
  }
}

/** Why there was no bonus, by the server's reason. */
export function storyVoidLine(s: StoryTicket): string {
  switch (s.void_reason) {
    case "expired":
      return "This story ended before the bonus. Your credit is kept.";
    case "deleted":
      return "Your story was deleted before the bonus time. Your credit is kept.";
    case "unreachable":
      return "We couldn't see your story at the bonus time. Your credit is kept.";
    case "refunded":
      return "This voucher was refunded.";
    default:
      return "No bonus on this Story. Your credit is kept.";
  }
}

/** The one line under the state: what to do now, or how it ended. */
export function storyLine(s: StoryTicket, now = Date.now()): string {
  const zone = zoneOf(s);
  if (storyLate(s, now)) return "Time ran out. Your credit is kept.";
  switch (s.state) {
    case "waiting_post":
      return "Post one story tagging @mesita and the restaurant, and leave it up. There is no deadline to post.";
    case "found":
      return "This story isn't tied to a voucher at this restaurant yet.";
    case "approved": {
      if (!s.bonus_at) return "Keep your story up. Your bonus lands by itself.";
      const left = storyLeft(s.bonus_at, now);
      return left
        ? `Don't delete your story until ${storyClock(s.bonus_at, zone, now)} · ${left}`
        : s.wait_sec != null && s.wait_sec < 600
          ? "Checking your story now. Your bonus lands in a moment."
          : "Checking your story now. Your bonus lands within 30 min.";
    }
    case "released":
      return `${storyBonus(s)} is in your credit.`;
    default:
      return storyVoidLine(s);
  }
}

/** The screen's poll delay (MESITA-4405, the server's numbers): every 5 s,
 *  every 15 s after 2 minutes; null stops it (approved, void, the deadline,
 *  or no hint). One timer at a time: the screen schedules the next call only
 *  after the last one answered. */
export function storyPollDelay(s: Pick<StoryTicket, "poll" | "state" | "deadline_at"> | null, startedMs: number, now: number): number | null {
  if (!s || !s.poll) return null;
  // MESITA-4426: past the deadline one more look lets the server end the
  // Story; an approved Story near its bonus (the server's hint) is asked
  // every 5 s so a test Story's 30-second bonus shows.
  if (s.state === "approved") return Math.max(1_000, s.poll.every_ms);
  if (s.state !== "waiting_post" && s.state !== "found") return null;
  if (storyLate(s, now)) return Math.max(1_000, s.poll.every_ms);
  const every = now - startedMs >= s.poll.slow_after_ms ? s.poll.slow_every_ms : s.poll.every_ms;
  return Math.max(1_000, every);
}
