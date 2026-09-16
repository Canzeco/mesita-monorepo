// The place tab vocabulary — names, labels, hrefs. Nothing else.
//
// This is split out of `place-view.ts` deliberately (MESITA-1558). That module
// also holds the two `cache()`d server reads, and those reach
// `lib/api/console` -> `lib/api/_invoke` and `place-manage/actions`
// -> `lib/supabase-ef` -> `lib/supabase/server`. A "use client" tab row that
// imports the vocabulary from there drags the whole server data layer into its
// bundle graph. `shell-contract.test.ts` names that invariant but cannot catch
// it: its rule is a per-file regex with no transitive walk.
//
// Keep this file free of server imports. It is the half a client component may
// have. `product-keys.ts` is importable for the same reason: it is vocabulary
// with no imports of its own.
import { PRODUCT_LABEL } from "@/lib/product-keys";

// THE TAB MATRIX: Profile · Menus · Reviews · Capabilities · Rewards · Admin,
// in the order the rail lists them under the PLACE SELECTOR (Pato, 2026-09-14:
// "better three sections … PLACE SELECTOR / Profile / Menus / Reviews /
// Capabilities / Rewards / Admin").
//
// MENUS ARRIVED IN MESITA-1848, split out of Profile — where `MenusSection`
// had always rendered as the last child of the longest form in the console.
// It joins the READ set, not the two that write: every held role could open it
// while it lived inside Profile, and splitting a view out must never quietly
// take a surface away from a viewer.
//
// TWO CHANGES FROM THE FLAT SIX (MESITA-1841):
//
//   ACTIVITY LEFT. It was a place view from MESITA-1537 until now. The drawing
//   puts it flush-left with the organization's pages, and that is the right
//   scope: an operator asking "how are we doing" is asking about the business,
//   not about one storefront. `/places/<id>/activity` forwards to the
//   organization's, which opens on the place that was selected.
//
//   REWARDS ARRIVED, split out of Capabilities. Capabilities is the ladder of
//   what a guest CAN do here — accept prepays, pickup, delivery, reservations —
//   plus the internal Settings zone. Rewards is what a guest EARNS: the
//   strategy ladder, Visit Rewards, and the Partnership body that prices them.
//   The two were one 440-line component (`PromosSection`) whose own headings
//   already drew the line; this makes the line an address.
//
// Capabilities is its own name again. MESITA-1815 renamed it to Settings —
// label AND segment — and MESITA-1841 puts both back, because the drawing says
// Capabilities and the word never stopped being the domain's (Notion Main
// §11.2, `state-vocabulary.ts`). `/places/<id>/settings` now forwards here,
// which is the reverse of the rule MESITA-1815 wrote.
//
// Profile USED to have no segment of its own: it was /places/<id>, and the
// other views hung beneath it. That made the one view an operator is most
// likely to send someone a link to the one view with no link — /places/<id>/profile
// answered 404 (MESITA-1732). It has its own address now, and the bare place
// URL is a temporary redirect onto it.
// ── ONE VIEW PER PRODUCT (MESITA-1885) ────────────────────────────────────
//
// Capabilities and Rewards are gone as views, and what replaced them is the
// PRODUCT each of their rows belonged to. Pato put all eight products in the
// rail; three of them — Orders, Reservations and Credits — were rows on the
// single Capabilities page, so three rail rows would have pointed at one
// address and lit up together. A rail row that cannot say which room it opens
// is MESITA-1833's law failing quietly, so the rooms got split to match the
// list.
//
// The split is the ladder's own: `ZONE_ROWS` (sections/controls/offerings.ts)
// is keyed by product now, and each view renders its product's rows. No row
// moved between products and none was invented — `offerings.test.ts` proves
// every guest row still belongs to exactly one zone.
//
// `/places/<id>/capabilities` forwards, temporarily: this answer has moved
// four times and a 308 caches today's in every browser forever.
//
// ── REWARDS IS A VIEW AGAIN, AND ITS FORWARD HAD TO DIE (MESITA-1900) ─────
//
// Pato's 2026-09-16 product list separates Rewards from Visits and files it
// under money, so `visit_rewards` and its strategy cards are the `rewards`
// zone and `/places/<id>/rewards` is a real page again.
//
// THE FORWARD MESITA-1887 ADDED FOR IT IS DELETED IN THE SAME COMMIT. A
// `next.config.ts` rule runs BEFORE filesystem routes, so leaving it would
// make this view unreachable with every check green — `/settings` in
// MESITA-1839 and `/credits` in MESITA-1885, twice recorded and once more
// here. It was `permanent: false`, which is the only reason deleting it is
// enough: no browser cached the answer.
// MENUS AND REVIEWS ARE NOT HERE (MESITA-1919). They are CARDS ON PROFILE
// again — `MenusSection`, `ReviewsSummary` and `MesitaReviewsList` flow in its
// masonry — so there is no name for `PlaceTabGate` to admit and
// `/places/<id>/menus` 404s like any other name off this contract. Neither
// ever had a rail row to lose: MESITA-1900 set the rail to Pato's eight
// products and neither was among them.
export const PLACE_TABS = [
  "profile",
  "visits",
  "orders",
  "reservations",
  "rewards",
  "pay",
  "credits",
  "admin",
] as const;
export type PlaceTab = (typeof PLACE_TABS)[number];

/** The six product views take their label from the PRODUCT vocabulary, not
 *  from a second list here: the rail row, the card and the page heading are
 *  one noun or an operator learns that one of the three is lying. It is why
 *  `pay` reads "Payments" on all three at once (MESITA-1900) without a single
 *  string changing in this file. */
export const PLACE_TAB_LABEL: Record<PlaceTab, string> = {
  profile: "Profile",
  visits: PRODUCT_LABEL.visits,
  orders: PRODUCT_LABEL.orders,
  reservations: PRODUCT_LABEL.reservations,
  rewards: PRODUCT_LABEL.rewards,
  pay: PRODUCT_LABEL.pay,
  credits: PRODUCT_LABEL.credits,
  admin: "Admin",
};

/** What the rail and the place layout know about a viewer on a place. `role`
 *  is the viewer's own `place_members` role; null when they hold none — which
 *  is every pool place (MESITA-1892: there is no holder above the place, so
 *  the role IS the membership). */
export type ViewerAccess = {
  /** The viewer holds a membership on this place. */
  held: boolean;
  role: "owner" | "editor" | "viewer" | null;
  isSuperAdmin: boolean;
};

/** Which tabs a viewer may open on a place — THE matrix, in one place.
 *
 *  pool place            → Profile only (it carries Claim)
 *  held · viewer         → Profile + Menus + Reviews (the read surfaces)
 *  held · owner/editor   → + the six PRODUCT views
 *  super-admin           → + Admin (operator internals)
 *
 *  THE PRODUCT VIEWS INHERIT CAPABILITIES' AND REWARDS' ACCESS EXACTLY
 *  (MESITA-1885). Splitting one write surface into five must not hand a
 *  viewer a switch, and must not take one from an editor: every row that was
 *  owner/editor-only still is, and the read set is untouched.
 *
 *  SIX SINCE MESITA-1900, and the sixth is Rewards taking back the access it
 *  had as a view of its own before MESITA-1885 folded it into Visits: the
 *  `visit_rewards` switch was owner/editor-only in every one of those shapes,
 *  so a view that carries it is owner/editor-only too.
 *
 *  Two callers, one rule (MESITA-1779). The place layout resolves it
 *  server-side for the place you are ON (`visibleTabs` in lib/place-view.ts
 *  delegates here). The rail applies it to the place it shows, from the role
 *  on the viewer's own row and the super-admin flag, so a place opens to its
 *  views WITHOUT being visited; the published set still wins on the place
 *  itself, where the server has the last word. */
export function tabsForAccess(access: ViewerAccess): PlaceTab[] {
  if (!access.held) return ["profile"];
  const tabs: PlaceTab[] =
    access.role === "viewer"
      ? // ONE VIEW, and that is not a narrowing (MESITA-1919). A viewer's three
        // were Profile, Menus and Reviews; the other two are cards on the first
        // one now, so the same person still reads the same things.
        ["profile"]
      : [
          "profile",
          "visits",
          "orders",
          "reservations",
          "rewards",
          "pay",
          "credits",
        ];
  if (access.isSuperAdmin) tabs.push("admin");
  return tabs;
}

/** A view's address. No organization rides along any more (MESITA-1807), and
 *  since MESITA-1892 there is none to ride: the place id is the whole scope,
 *  and the rail reads it off the pathname. */
export function placeTabHref(placeId: string, tab: PlaceTab): string {
  return `/places/${encodeURIComponent(placeId)}/${tab}`;
}

/** Which view a place pathname is showing, or null if it is not one.
 *
 *  ONE reader for the segment→tab rule. It used to be written twice, in the
 *  rail and in the page heading, both as `split("/")[3] ?? "profile"` — the
 *  `??` being the bare-URL special case. Two copies of a routing rule is one
 *  copy too many, and the fallback is now a lie: the bare URL redirects rather
 *  than rendering Profile.
 *
 *  Returns null for anything that is not a known tab, so a future segment
 *  cannot silently light up the Profile row. */
export function placeTabFromPathname(pathname: string): PlaceTab | null {
  const seg = pathname.split("/")[3];
  return (PLACE_TABS as readonly string[]).includes(seg ?? "")
    ? (seg as PlaceTab)
    : null;
}
