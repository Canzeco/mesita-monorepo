// THE STORY VOUCHER'S LINE (MESITA-4264, MESITA-4297): what the Wallet row,
// its sheet and Me › Tickets say about a BOUGHT Story's bonus, by the
// server's state. The waiter approved the story before payment; the paid
// amount is already in the balance; only the bonus waits, 3 hours after
// payment. Times read in the place's own zone, absolute ("bonus at 17:05").
// A PLAIN MODULE: no React.

import type { StoryVoidReason, WaitingStory } from "@/lib/api/wallet";

const VOID_LINE: Record<StoryVoidReason, string> = {
  unreachable: "Bonus not added: the story was not up 3 hours later",
  expired: "Bonus not added: no story was approved in time",
  refunded: "Bonus not added: the voucher was refunded",
  operator: "Bonus not added",
  not_verified: "Bonus not added: this story was already used for another Story voucher",
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

/** The one line for a bought Story voucher, by its state. */
export function storyLine(s: WaitingStory, now = Date.now()): string {
  switch (s.state) {
    case "processing":
      return "Payment processing · keep your story up";
    case "approved":
      if (storyChecking(s, now)) return "Checking your story…";
      return s.bonus_at
        ? `Bonus at ${storyClock(s.bonus_at, s.time_zone, now)} · keep your story up until then`
        : "Keep your story up · bonus in 3 hours";
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
