// THE STORY VOUCHER'S LINE (MESITA-4264; the Story record since
// MESITA-4405): what the Wallet's Story row and the Vouchers ticket say
// about a Story's bonus. The paid amount is already in the balance; the
// Story's steps (post, the waiter, the bonus) are on its own screen
// (lib/story-ticket.ts). Times read in the place's own zone ("17:05").
// A PLAIN MODULE: no React.

import type { WaitingStory } from "@/lib/api/wallet";

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

/** "2 h 14 min left" until `iso`, whole minutes, or null once it has passed.
 *  Under 2 minutes it counts seconds, "24 s left" (MESITA-4426: a test
 *  Story's 30-second bonus and 2-minute deadline). */
export function storyLeft(iso: string | null, now = Date.now()): string | null {
  if (!iso) return null;
  const at = Date.parse(iso);
  if (!Number.isFinite(at) || at <= now) return null;
  if (at - now < 120_000) return `${Math.ceil((at - now) / 1_000)} s left`;
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
function voidLine(s: WaitingStory): string {
  switch (s.bonus_void_reason) {
    case "expired":
      return "Time ran out before a waiter approved a story. Your credit is kept.";
    case "deleted":
      return "Your story was deleted before the bonus time.";
    case "unreachable":
      return "We couldn't see your story at the bonus time, so the bonus didn't apply.";
    case "refunded":
      return "Refunded.";
    default:
      return "Bonus not added";
  }
}

/** The one line for a Story on the Wallet, by its state: before approval
 *  the Story's next step, after it the countdown to the bonus. */
export function storyLine(s: WaitingStory, now = Date.now()): string {
  switch (s.state) {
    case "waiting": {
      if (!s.bonus_at) return "Post your story and show it to the waiter.";
      if (storyChecking(s, now)) return STORY_CHECKING_LINE;
      const left = storyLeft(s.bonus_at, now);
      return `Don't delete it until ${storyClock(s.bonus_at, s.time_zone, now)}${left ? ` · ${left}` : ""}`;
    }
    case "checking":
      return STORY_CHECKING_LINE;
    case "released":
      return "Bonus added";
    case "void":
      return voidLine(s);
    default:
      return "No bonus on this Story.";
  }
}

/** The bonus is still on its way (not added, not voided). */
export function storyBonusOpen(s: Pick<WaitingStory, "state">): boolean {
  return s.state === "waiting" || s.state === "checking";
}

/** The Wallet's Stories (MESITA-4446): only open ones. The server's
 *  `waiting_stories` also carries Stories decided in the last 24 h for
 *  Tickets' history; on the Wallet a decided one was a row nobody could
 *  dismiss, and it blocked Remove on that place's Loyalty Card. */
export function openStories<T extends Pick<WaitingStory, "state">>(list: readonly T[]): T[] {
  return list.filter(storyBonusOpen);
}
