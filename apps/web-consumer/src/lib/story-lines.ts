// THE STORY VOUCHER'S LINE (MESITA-4264): what the Wallet row, its sheet and
// Me › Tickets say about a Story voucher's bonus, by the server's state.
// The paid amount is already in the balance; only the bonus waits. Times
// read in the place's own zone, absolute ("bonus from 17:05"). A PLAIN
// MODULE: no React.

import type { StoryVoidReason, WaitingStory } from "@/lib/api/wallet";

const VOID_LINE: Record<StoryVoidReason, string> = {
  unreachable: "Bonus not added: the story was not up 3 hours later",
  expired: "Bonus not added: no story was approved within 7 days",
  refunded: "Bonus not added: the voucher was refunded",
  operator: "Bonus not added",
};

function parts(iso: string, timeZone: string): Intl.DateTimeFormatPart[] | null {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return null;
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone,
      month: "short",
      day: "numeric",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(at);
  } catch {
    return timeZone === "America/Mexico_City" ? null : parts(iso, "America/Mexico_City");
  }
}

function part(p: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  return p.find((x) => x.type === type)?.value ?? "";
}

/** "Nov 24" in the place's zone. */
export function storyDate(iso: string, timeZone: string): string {
  const p = parts(iso, timeZone);
  return p ? `${part(p, "month")} ${part(p, "day")}` : "";
}

/** "17:05" in the place's zone, or "Tue 01:05" when it is not today there. */
export function storyClock(iso: string, timeZone: string, now = Date.now()): string {
  const p = parts(iso, timeZone);
  if (!p) return "";
  const clock = `${part(p, "hour")}:${part(p, "minute")}`;
  const today = parts(new Date(now).toISOString(), timeZone);
  const sameDay = today && storyDate(iso, timeZone) === `${part(today, "month")} ${part(today, "day")}`;
  return sameDay ? clock : `${part(p, "weekday")} ${clock}`;
}

/** The bonus is past its time and the server is re-checking the story. */
export function storyChecking(s: Pick<WaitingStory, "state" | "bonus_at">, now = Date.now()): boolean {
  if (s.state !== "approved" || !s.bonus_at) return false;
  const at = Date.parse(s.bonus_at);
  return Number.isFinite(at) && now >= at;
}

/** The one line for a Story voucher, by its state. */
export function storyLine(s: WaitingStory, now = Date.now()): string {
  const by = s.expires_at ? ` · get it approved by ${storyDate(s.expires_at, s.time_zone)}` : "";
  switch (s.state) {
    case "needs_story":
      return `Post a story mentioning @mesita and the place's Instagram${by}`;
    case "received":
      return `A story from you arrived · show the QR to staff${by}`;
    case "rejected":
      return "Not approved · post a new story mentioning @mesita and the place's Instagram";
    case "approved":
      if (storyChecking(s, now)) return "Checking your story…";
      return s.bonus_at ? `Approved · bonus from ${storyClock(s.bonus_at, s.time_zone, now)}` : "Approved";
    case "released":
      return "Bonus added";
    case "void":
      return VOID_LINE[s.bonus_void_reason ?? "operator"] ?? VOID_LINE.operator;
  }
}

/** The bonus is still on its way (not added, not voided). */
export function storyBonusOpen(s: Pick<WaitingStory, "state">): boolean {
  return s.state !== "released" && s.state !== "void";
}
