// THE STORY VOUCHER'S LINE (MESITA-4264; MESITA-4296): what the Wallet row,
// its page and Me › Tickets say about a Story voucher's bonus, by the
// server's state. The story was found before payment and the paid amount is
// already in the balance; only the bonus waits, 3 hours after payment, if
// the story is still up. Times read in the place's own zone ("17:05").
// A PLAIN MODULE: no React.

import { money, type WaitingStory } from "@/lib/api/wallet";

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

/** "2 h 14 min left" until `iso`, whole minutes, or null once it has passed. */
export function storyLeft(iso: string | null, now = Date.now()): string | null {
  if (!iso) return null;
  const at = Date.parse(iso);
  if (!Number.isFinite(at) || at <= now) return null;
  const min = Math.ceil((at - now) / 60_000);
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min left`;
  return m === 0 ? `${h} h left` : `${h} h ${m} min left`;
}

/** The bonus time has come and the server is re-checking the story: the
 *  server says `checking`, or a `waiting` row whose time just passed. */
export function storyChecking(s: Pick<WaitingStory, "state" | "bonus_at">, now = Date.now()): boolean {
  if (s.state === "checking") return true;
  if (s.state !== "waiting" || !s.bonus_at) return false;
  const at = Date.parse(s.bonus_at);
  return Number.isFinite(at) && now >= at;
}

export const STORY_CHECKING_LINE = "Checking your story now. Your bonus lands within 30 min.";

/** Why the bonus did not apply, by the server's reason. */
function voidLine(s: WaitingStory, now: number): string {
  const paid = money(s.amount_cents, s.currency);
  const bonus = `+${money(s.bonus_cents, s.currency)}`;
  switch (s.bonus_void_reason) {
    case "unreachable": {
      const at = s.bonus_decided_at ?? s.recheck_at ?? s.bonus_at;
      return at
        ? `Your story was gone at ${storyClock(at, s.time_zone, now)}, so the bonus didn't apply.`
        : "Your story was gone, so the bonus didn't apply.";
    }
    case "mention_lost":
      return `Your ${paid} credit is in your Wallet. The ${bonus} bonus didn't apply: your story was too old by the time payment finished.`;
    case "refunded":
      return s.refunded ? "Refunded. Your story is free to use again." : "No bonus on this Story.";
    case "expired":
      return `Story review ended. Your ${paid} credit is kept.`;
    default:
      return "No bonus on this Story.";
  }
}

/** The one line for a Story voucher, by its state. */
export function storyLine(s: WaitingStory, now = Date.now()): string {
  switch (s.state) {
    case "waiting": {
      if (storyChecking(s, now)) return STORY_CHECKING_LINE;
      if (!s.bonus_at) return "Don't delete your story yet.";
      const left = storyLeft(s.bonus_at, now);
      return `Don't delete it until ${storyClock(s.bonus_at, s.time_zone, now)}${left ? ` · ${left}` : ""}`;
    }
    case "checking":
      return STORY_CHECKING_LINE;
    case "released":
      return "Bonus added";
    case "void":
      return voidLine(s, now);
    default:
      return "No bonus on this Story.";
  }
}

/** The bonus is still on its way (not added, not voided). */
export function storyBonusOpen(s: Pick<WaitingStory, "state">): boolean {
  return s.state === "waiting" || s.state === "checking";
}
