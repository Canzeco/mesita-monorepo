import { isPlaceReservePath } from "@/lib/consumer-route-contract";
import { safeNextPath } from "@/lib/auth-redirect";

// WHY THE VISITOR IS ON SIGN (MESITA-4246, design C2). Read from `next`, so
// the Sign page says it ("Sign in to book") and `signup_from` can count it.
// One classifier for both; a gift and a Pay QR keep their own lines on the
// page (it reads those first).

export type SignAction = "reserve" | "offers" | "social" | "place" | "gift" | "pay" | "plain";

export function signActionFromNext(raw: string | null | undefined): SignAction {
  const next = safeNextPath(raw);
  if (!next) return "plain";
  const path = next.split(/[?#]/)[0]!;
  if (path.startsWith("/wallet/gift/") || /[?&]gift=/.test(next)) return "gift";
  if (path === "/pay" || path.startsWith("/pay/")) return "pay";
  if (isPlaceReservePath(path)) return "reserve";
  // Offers is its own page since MESITA-4379; `?rewards=` on the place is
  // the address it had before.
  if (/^\/place\/[^/]+\/offers(\/[^/]+)?\/?$/.test(path)) return "offers";
  if (path.startsWith("/place/") && /[?&]rewards=/.test(next)) return "offers";
  if (path.startsWith("/place/")) return "place";
  if (path === "/home/social") return "social";
  return "plain";
}

/** The Sign headline and line for an action. */
export function signIntentFromNext(raw: string | null | undefined): {
  action: SignAction;
  headline: string;
  title: string | undefined;
} {
  const action = signActionFromNext(raw);
  switch (action) {
    case "reserve":
      return { action, headline: "Sign in to book", title: "Your table is one step away." };
    case "offers":
      return { action, headline: "Sign in to buy this offer", title: undefined };
    case "place":
      return { action, headline: "Sign in to save places", title: undefined };
    case "social":
      return { action, headline: "Sign in to see people", title: undefined };
    default:
      return { action, headline: "Discover your next favorite place.", title: undefined };
  }
}
