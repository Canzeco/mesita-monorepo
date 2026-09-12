"use client";

import { Z_BOTTOM_NAV } from "@/lib/z-index";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ComponentType } from "react";
import { QrCode, Search, User } from "lucide-react";
import { MesitaMark } from "@/components/brand/MesitaMark";
import { ComingSoonModal } from "./ComingSoonModal";
import { cn } from "@/lib/utils";
import {
  CONSUMER_RESERVATION_SURFACE_PREFIX,
  CONSUMER_ROUTES,
  CONSUMER_ROUTE_PREFIX,
} from "@/lib/consumer-route-contract";
import { trackEvent } from "@/lib/analytics/track";
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";

// FOUR top-level surfaces, in this order (Pato, MESITA-1609):
//
//   Home · Search · Pay · Me
//
// FOUR IS STILL THE CEILING — this reorders and relabels the same four-tab
// bar the 2026-09-06 call locked (Discover · Pay · Activity · Me), it does
// not widen it. Two things moved:
//
//   HOME AND SEARCH SPLIT BACK APART. Discover merged them 2026-09-01
//   because Home had nothing live behind it — five modes that all opened
//   coming-soon dialogs, so the dead tab happened to be the leftmost one.
//   That reasoning is retired now that Home has a real body again: Swipe,
//   Feed, Catalog, Chat and Favs, the five modes DiscoverModeNav carries
//   today (see that file — Feed joined at MESITA-1621). Search keeps its own screen exactly as it was — the map, the
//   one search bar — only its address changes, from a mode pill to a tab of
//   its own. This is NOT the 2026-09-01 merge being re-litigated; it is the
//   merge's own stated reason (Home is dead weight) no longer being true.
//
//   ACTIVITY RETIRED AS A TAB. Its three sections (Alerts, Visits,
//   Reservations) did not go anywhere — /inbox and its own pill row are
//   unchanged — but the DOOR into them moved to three boxes on Me instead of
//   a dedicated fourth-of-four tab. See profile-sections.tsx / ProfileClient
//   for where they live now.
//
// PAY STAYS PUT, third of four, unaffected by either move — Wallet's home
// (inside Pay, not its own tab, not Activity's) is a separate, still-closed
// decision (MESITA-1581) and this PR does not reopen it.
//
// SEARCH'S ROUTE MOVED (MESITA-1616), a day after MESITA-1609 promoted the
// TAB. The tab move alone left the URL at /discover/search, still nested
// under discover/layout.tsx — so Home's mode rail kept rendering on top of
// the map, a bug, not a design choice. Search now lives at its own /search,
// no shared layout with Home. HOME'S RAIL ALSO REORDERS the same PR
// (MESITA-1615): Swipe leads and is the default now, not Catalog.
//
// At four items each column is ~94px at 375px, which is why the active
// underline is w-6 rather than w-5 — a 20px rule under a 94px column reads
// thin. Unchanged by this PR: the column count is still four.
//
// Every tab shows its plain label. Me used to append the live class ("Me ·
// Standard") — dropped 2026-08-16 (Pato: "only write me, its cleaner"). A tab
// label names a DESTINATION; the class is state, and state belongs on the Me
// page where it can be read and acted on, not stamped into the chrome of every
// screen. MESITA-1119's mockup (Agents tab + class-suffixed Me) is superseded
// by Rules §2 and Docs › Apps §A — still true, unaffected by the Home/Search/Activity
// moves above. `route-structure.test.tsx` pins the plain labels, in order,
// and their count.

// Every icon is a lucide glyph except Home's, which carries the brand mark —
// back where it started before the 2026-09-01 merge swapped it for a
// magnifier. That swap existed because Discover, as one tab, would otherwise
// lose its only recognisable affordance; the argument doesn't survive Search
// becoming its own tab; the magnifier returns there instead, and Home gets
// the mark back for free. The signature stays wider than LucideIcon so a
// future non-lucide glyph does not force a type change at every call site.
type Item = {
  href: string;
  Icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  /**
   * Every pathname prefix that lights this tab. A LIST, not one-plus-a-spare:
   * the previous shape was one required prefix plus one optional spare, Activity
   * had already spent the spare on /reservation, and a third prefix (Home's
   * /place) was hard-coded as a special case down in the render. Three ways to
   * say one thing meant a tab could silently light NOTHING — which is exactly
   * what happens to a detail route that stops nesting under its tab's prefix.
   *
   * Order is irrelevant; matching is `startsWith` over the whole list.
   */
  matchPrefixes: readonly string[];
  // Surface is parked. Tab stays visible and tappable; tap opens
  // ComingSoonModal instead of navigating (MESITA-383 — no "Soon" pills).
  soon?: boolean;
  soonTitle?: string;
  soonBody?: string;
};

const ITEMS: Item[] = [
  {
    // Home IS the mode rail's landing (Swipe, per discoverDefault — MESITA-
    // 1615) — no extra redirect hop, the href is the live surface itself.
    href: CONSUMER_ROUTES.discoverDefault,
    // The brand mark, back where it started before the 2026-09-01 merge gave
    // it to the magnifier. See the file-top comment for why that swap is
    // reversed now rather than kept.
    Icon: MesitaMark,
    label: "Home",
    // FIVE EXPLICIT SEGMENTS (Feed joined at MESITA-1621), not a blanket
    // "/discover" prefix — that prefix is gone from the route contract
    // (MESITA-1609) precisely because it can no longer answer "which tab
    // lights" on its own. /place rides here exactly as it rode Discover
    // before — drop it and place detail lights NOTHING, which route-structure
    // T5's cardinality assertion is what catches.
    //
    // EVERY MODE NEEDS ITS OWN LINE. A mode added to DiscoverModeNav and
    // missed here renders its screen with the bottom bar showing NO tab lit —
    // tsc cannot see it, and only T5's matrix does.
    matchPrefixes: [
      CONSUMER_ROUTE_PREFIX.place,
      CONSUMER_ROUTES.discoverTabs.scroll,
      CONSUMER_ROUTES.discoverTabs.feed,
      CONSUMER_ROUTES.discoverTabs.chat,
      CONSUMER_ROUTES.discoverTabs.favs,
    ],
  },
  {
    // Its own top-level route now (MESITA-1616), not nested under Home's
    // discover/layout.tsx — that nesting was a bug: it kept rendering Home's
    // mode rail above the map on the Search tab. Same screen (map + the one
    // search bar), independent route.
    href: CONSUMER_ROUTES.search,
    // The magnifier, handed back from Home — see the file-top comment.
    Icon: Search,
    label: "Search",
    // ONE EXACT SEGMENT — Search has no siblings to disambiguate from any
    // more, unlike Home's four-segment list above.
    matchPrefixes: [CONSUMER_ROUTES.search],
  },
  {
    href: CONSUMER_ROUTES.newVisit.root,
    // QR is the right glyph and stays: showing the QR IS the visit.
    Icon: QrCode,
    // "Pay" (Pato, 2026-08-17), reversing the 2026-08-16 call for "Visit".
    // The tab is named for what the guest came to DO — the QR they show is the
    // moment they pay — rather than for the object it creates.
    //
    // THE LABEL MOVED, AND NOTHING ELSE. The route is still /new-visit, the
    // detail is still /visit/{id} and the object is still a visit ticket. This
    // tab has now been called Rewards, Pay, Visit and Pay again; every one of
    // those renames stayed in the label, which is why the URLs and the schema
    // survived four of them.
    //
    // "Pay" no longer collides with Stripe: `checkout` is the word for Stripe
    // in this codebase, and the one Stripe surface a consumer can reach says
    // "Continue to checkout" (PlanModal). Paying a BILL and checking out of a
    // SUBSCRIPTION stay two different words.
    label: "Pay",
    // ONE PREFIX COVERS BOTH SECTIONS. Wallet lives inside this tab at
    // /new-visit/wallet (MESITA-1581, untouched by this PR), so it nests
    // under /new-visit and lights Pay for free — which is the whole point of
    // a section living in its container's namespace.
    matchPrefixes: [CONSUMER_ROUTE_PREFIX.newVisit],
    // LIVE — the pass (QR + code + what you can claim + live visit) and the
    // ticket stack are built; the tab opens the real page.
  },
  {
    href: CONSUMER_ROUTES.me,
    Icon: User,
    label: "Me",
    // ABSORBS ACTIVITY'S OLD PREFIXES (MESITA-1609). Activity retired as its
    // own tab, but /inbox, /visit and /reservation did not move — they are
    // reached now from three boxes on Me instead of a fourth tab, so the
    // ROUTES that used to light Activity now light Me:
    //   /inbox/*          the Alerts/Visits/Reservations sections
    //   /visit/{id}       reached from the centre tab AND Me > Visits
    //   /reservation/{id} reached from a place AND Me > Reservations
    // Drop any of these three and that surface lights NOTHING — the same
    // failure route-structure T5 exists to catch, just against Me now
    // instead of Activity.
    matchPrefixes: [
      CONSUMER_ROUTE_PREFIX.me,
      CONSUMER_ROUTE_PREFIX.visit,
      CONSUMER_RESERVATION_SURFACE_PREFIX,
    ],
  },
];

const SEARCH_COACHMARK_STORAGE_KEY = "mesita:search-tab-coachmark-seen";
const SEARCH_COACHMARK_AUTO_DISMISS_MS = 5500;

/** Same one-shot shape as SwipeDeck's tutorial flag (readTutorialSeen) — a
 * new key, no legacy value to migrate. */
function readSearchCoachmarkSeen(): boolean {
  try {
    return window.localStorage.getItem(SEARCH_COACHMARK_STORAGE_KEY) != null;
  } catch {
    /* private mode / blocked storage */
  }
  return false;
}

function writeSearchCoachmarkSeen(): void {
  try {
    window.localStorage.setItem(SEARCH_COACHMARK_STORAGE_KEY, "1");
  } catch {
    /* best-effort */
  }
}

// Points at the Search tab for guests whose muscle memory taps the old
// leftmost-tab-opens-the-map position — Home lives there now (MESITA-1609,
// fast-follow MESITA-1610). `pointer-events-none` on purpose: dismissal comes
// from the REAL fix (tapping Search, same as SwipeTutorialOverlay dismisses
// on a real swipe) or the auto-timer, never from tapping the hint itself —
// the bubble can visually spill into a neighboring tab's column and must
// never steal that tap.
function SearchTabCoachmark() {
  return (
    <div className="animate-in fade-in zoom-in-95 pointer-events-none absolute bottom-full left-1/2 mb-3 -translate-x-1/2 duration-300">
      <div className="bg-primary text-primary-foreground shadow-glow-sm type-label relative rounded-xl px-3 py-2 font-semibold whitespace-nowrap">
        The map moved here
        <span className="bg-primary absolute -bottom-1 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rotate-45 rounded-[2px]" />
      </div>
    </div>
  );
}

export function BottomNav({ userId }: { userId?: string }) {
  // The inbox tab (and its pending-notification badge) left the tab bar when
  // Home/Search took over discovery; the prop stays so the shell layout call
  // site doesn't churn while other agents work this tree.
  void userId;
  const pathname = usePathname();
  const [soonItem, setSoonItem] = useState<Item | null>(null);
  const [showSearchCoachmark, setShowSearchCoachmark] = useState(false);
  const getSupabase = useLazyBrowserSupabase();

  // First-launch hint, one shot per browser — identical shape to SwipeDeck's
  // tutorial overlay effect: schedule the show on a frame so hydration stays
  // clean, auto-dismiss on a timer, and write the flag either way it closes.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (readSearchCoachmarkSeen()) return;
    const raf = requestAnimationFrame(() => {
      setShowSearchCoachmark(true);
    });
    const t = window.setTimeout(() => {
      setShowSearchCoachmark(false);
      writeSearchCoachmarkSeen();
    }, SEARCH_COACHMARK_AUTO_DISMISS_MS);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(t);
    };
  }, []);

  const dismissSearchCoachmark = () => {
    if (!showSearchCoachmark) return;
    setShowSearchCoachmark(false);
    writeSearchCoachmarkSeen();
  };

  return (
    <>
      <nav
        // Hook for surfaces that own their whole frame and suppress the tab
        // bar in CSS (place detail — see PlaceDetailPageBody). A data attribute
        // rather than a route list here: whether the nav belongs on a screen is
        // that screen's statement, and the pathname alone can't tell the
        // hard-nav place PAGE from the intercepted place MODAL, which share it.
        data-shell-nav=""
        className={cn(
          "border-border bg-card/95 shrink-0 border-t px-0.5 pt-2 backdrop-blur",
          Z_BOTTOM_NAV,
        )}
      >
        <div className="flex items-end justify-around">
          {ITEMS.map((item) => {
            const { href, Icon, label, matchPrefixes, soon } = item;
            const active = matchPrefixes.some((p) => pathname.startsWith(p));
            const isSearchTab = href === CONSUMER_ROUTES.search;
            // Parked surfaces stay tappable — open ComingSoonModal (no Soon pill).
            if (soon) {
              return (
                <button
                  key={href}
                  type="button"
                  onClick={() => {
                    trackEvent(getSupabase(), "nav_tab_tap", { tab: label });
                    setSoonItem(item);
                  }}
                  aria-haspopup="dialog"
                  title={item.soonTitle ?? "Coming soon"}
                  className="text-muted-foreground hover:text-foreground type-meta relative flex min-w-0 flex-1 flex-col items-center gap-1 rounded-lg px-0.5 py-1 font-medium transition"
                >
                  <span className="relative flex h-8 w-8 items-center justify-center rounded-full">
                    <Icon className="h-5 w-5" strokeWidth={1.75} />
                  </span>
                  <span className="w-full truncate text-center">{label}</span>
                </button>
              );
            }

            return (
              <Link
                key={href}
                href={href}
                onClick={() => {
                  trackEvent(getSupabase(), "nav_tab_tap", { tab: label });
                  if (isSearchTab) dismissSearchCoachmark();
                }}
                className={cn(
                  "type-meta relative flex min-w-0 flex-1 flex-col items-center gap-1 rounded-lg px-0.5 py-1 font-medium transition",
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {active && (
                  <span className="bg-primary absolute -top-2 left-1/2 h-0.5 w-6 -translate-x-1/2 rounded-full" />
                )}
                {isSearchTab && showSearchCoachmark && <SearchTabCoachmark />}

                <span
                  className={cn(
                    "relative flex h-8 w-8 items-center justify-center rounded-full transition",
                    active && "bg-primary/10 ring-primary/20 ring-1",
                  )}
                >
                  <Icon
                    className="h-5 w-5"
                    strokeWidth={active ? 2.25 : 1.75}
                  />
                </span>
                <span className="w-full truncate text-center">{label}</span>
              </Link>
            );
          })}
        </div>
        <div className="bg-foreground/20 mx-auto mt-1.5 mb-1 h-1 w-32 rounded-full" />
      </nav>
      <ComingSoonModal
        open={soonItem != null}
        onClose={() => setSoonItem(null)}
        title={soonItem?.soonTitle ?? "Coming soon"}
        body={soonItem?.soonBody}
        // Item.Icon is deliberately wider than LucideIcon (Home renders the
        // brand mark), so it can't be forwarded here. No tab is parked today;
        // when one is, give it a real lucide glyph rather than widening the
        // modal's prop.
        icon={QrCode}
      />
    </>
  );
}
