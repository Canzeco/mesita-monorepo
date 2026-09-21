"use client";

// THE RIGHT HALF OF SETUP — one product, open (MESITA-1981).
//
// Pato, 2026-09-18: *"setup here in the computer make it two screns, 50% and
// 50%. left to slect categoery, the same list. right to setup shit subpahe
// basically."*
//
// ── IT RENDERS THE REAL VIEW, IT DOES NOT REBUILD IT ───────────────────────
//
// Seven products have a screen — Profile, Member Visits, Online Orders, Online
// Reservations, Prepaid Credits, Mesita Capital, and Payments through its own
// route — and those screens take NO PROPS: every one of them reads
// `usePlaceScope()`, which `places/[id]/layout` publishes. Setup sits inside
// that layout, so the pane mounts the same component the standalone address
// mounts. Two PLACEMENTS of one source, never two sources — the rule Home's
// log preview already lives by.
//
// The standalone `/places/<id>/<view>` addresses keep working. They are what a
// pasted link opens, and deleting them to force everything through `?p=` would
// break every door already written down in a blocker row.
//
// ── AND THE ONES WITHOUT ─────────────────────────────────────────────────
//
// Pato picked the complete answer: every product gets a pane, Coming included.
// A list where most rows do nothing when clicked teaches you that
// clicking mostly fails, which is the one thing a two-pane layout promises it
// will not do.
//
// So a product with no screen still gets a page: its mark, its name, what it
// is, what state it is in, and then EITHER its dial or a stated absence.
// Customer Intelligence has a real dial (`customerIntel`); the rest say plainly
// that there is nothing to set yet. A STATED ABSENCE IS A DESIGN; an empty
// panel is not, and a fake form for a product that does not exist is worse than
// either.
import { useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useHalf } from "@/components/shared/Half";
import { NotHeld, usePlaceScope } from "@/components/console/PlaceScope";
import { PartnerPane } from "@/components/console/PartnerPane";
import { ProfileView } from "@/components/views/ProfileView";
import { MenuView } from "@/components/views/MenuView";
import { ReviewsView } from "@/components/views/ReviewsView";
import { VisitsView } from "@/components/views/VisitsView";
import { OrdersView } from "@/components/views/OrdersView";
import { ReservationsView } from "@/components/views/ReservationsView";
import { RewardsView } from "@/components/views/RewardsView";
import { PayView } from "@/components/views/PayView";
import { CreditsView } from "@/components/views/CreditsView";
import { CapitalView } from "@/components/views/CapitalView";
import { DevelopersView } from "@/components/views/DevelopersView";
import { LineView } from "@/components/views/LineView";
import { WebsiteView } from "@/components/views/WebsiteView";
import { ProductStateBadge } from "@/components/shared/Badges";
import {
  HEADER_TAB,
  HEADER_TAB_ACTIVE,
  HEADER_TAB_REST,
  HeaderTabs,
  PageHeader,
} from "@/components/console/PageHeader";
import type { ProductCard } from "@/lib/products";
import type { ProductKey } from "@/lib/product-keys";
import { PRODUCT_MARK } from "@/lib/product-marks";
import { hasHalf, isSplit } from "@/lib/product-halves";
import { PRODUCT_SLUG, productHref, type PlaceHalf } from "@/lib/product-routes";
import { placeIdFromPathname, placePlanHref } from "@/lib/console-routes";
import { PLAN_LABEL } from "@/mock/types";
import { Group } from "@/components/shared/Group";
import { Rule } from "@/components/shared/Rule";
import { cn } from "@/lib/utils";

/** MESITA PARTNER'S SCREEN IS ITS OWN NOW (MESITA-2012).
 *
 *  MESITA-2011 pointed this key at the Plan row's whole pane — renewal line,
 *  Manage strip, four-rung ladder — because Partner had just become a product
 *  and the pane was already written. Pato: *"this goes into plan, not mesita
 *  partner, different things."* The purchase went back to `/plan` and
 *  `PartnerPane` is what a product screen for a derived badge looks like.
 *
 *  IT TAKES A PLACE AND `PRODUCT_VIEW` HANDS ITS COMPONENTS NOTHING, so this
 *  wrapper reads the scope the way every other view does — the one wrapper
 *  left in this file, and now the only reason it exists. */
function PartnerProduct() {
  const { place } = usePlaceScope();
  if (!place) return <NotHeld />;
  return <PartnerPane place={place} />;
}

/** THE ELEVEN THAT HAVE A SCREEN. Keyed by PRODUCT key, not by `PlaceTab`:
 *  `pay`'s screen is `PayView` but its address is a sub-step rather than a tab,
 *  and `menu`'s door is Profile, which is somebody else's screen. A record over
 *  the product key says both of those out loud instead of hiding them behind a
 *  cast that happens to work. */
const PRODUCT_VIEW: Partial<Record<ProductKey, () => React.ReactElement | null>> = {
  profile: ProfileView,
  // THE BADGE, NOT THE PURCHASE (MESITA-2011, split in 2012).
  partner: PartnerProduct,
  // ONLINE REVIEWS IS A ROW AGAIN (MESITA-2011), so `ReviewsView` is mounted
  // by its own key rather than as Profile's Activity half. It is
  // Activity-only, which `PRODUCT_HALVES` states and the router enforces —
  // this record says WHICH component, never on which surface.
  reviews: ReviewsView,
  // DIGITAL MENU HAS ITS OWN SCREEN NOW (MESITA-1984), so it stops borrowing
  // Profile's. Its `tab` goes back to null with it: the pane is the door, and
  // pointing the card at `/profile` would send an operator to the page the
  // menus just left.
  menu: MenuView,
  visits: VisitsView,
  orders: OrdersView,
  reservations: ReservationsView,
  pay: PayView,
  credits: CreditsView,
  capital: CapitalView,
  // DEVELOPERS PLATFORM HAS ONE NOW (MESITA-1992). Pato: *"mention API key and
  // MCP here."* It was the one LIVE product sitting on the unbuilt-product
  // empty state, which said "Not here yet" about a row whose own badge read On.
  access: DevelopersView,
  // THE VOICE SESSION'S TWO (MESITA-2017): the Agent's line and what it may
  // take; the Website's template and its three states.
  line: LineView,
  website: WebsiteView,
};

/** Member Visits' own program screen, reached from `VisitsView`. Held here so
 *  the import is not dead weight the day a rewards row wants its own pane. */
void RewardsView;

export function ProductPane({ card }: { card: ProductCard }) {

  const View = PRODUCT_VIEW[card.key] ?? null;
  /** Is the body something other than a restatement of the note? */
  const hasBody = View !== null || card.key === "customers";

  const half = useHalf();
  const { place } = usePlaceScope();
  const router = useRouter();

  const body = useMemo(() => {
    // LOCKED IS GATED ONCE, HERE (MESITA-2034, D12A). Every view used to
    // decide its own Locked state — `LineView`/`WebsiteView` checked
    // `planAtLeast` themselves and `VisitsView` never checked at all, so a
    // place below Ultra saw a live "Open Rewards" door under a header reading
    // Locked. One gate for every product, on both halves, replaces eleven
    // chances to forget it. `card.note` already carries "Needs {rung}." —
    // `buildProductCards` writes it, so this reads the fact rather than
    // re-deriving it.
    if (card.state === "locked" && place) {
      return (
        <Group title={card.note ?? "Locked"} allowOneRow>
          <Rule
            label={`This place is on ${PLAN_LABEL[place.plan]}`}
            note="Move the rung on Plan and this screen fills in."
            control={{
              kind: "button",
              label: "Open Plan",
              emphasis: "primary",
              onClick: () => router.push(placePlanHref(place.id)),
            }}
          />
        </Group>
      );
    }

    // THE VIEW ONLY RENDERS ON A HALF THE PRODUCT ACTUALLY HAS (MESITA-2004).
    //
    // This line used to read `if (View) return <View />` with no mention of
    // `half`, and that was a live bug: four products — Profile, Online Reputation,
    // Digital Menu, Online Payments — have a view and NO `Half` markers inside
    // it, so `/activity/mesita-profile` rendered the entire Profile editor.
    // The same screen, at two addresses, with the Activity tab lit.
    //
    // It was invisible while the halves were two top-level tabs twelve rows
    // apart. A tab pair on the product itself puts them one click apart, which
    // is why this had to be fixed before the pair could ship.
    //
    // `activity/[product]/page.tsx` refuses the address outright, so in the
    // console this branch is unreachable. It stays because `ProductPane` also
    // mounts under the standalone `/places/<id>/<view>` addresses, where
    // nothing has gated the half.
    if (View && (half === null || hasHalf(card.key, half))) return <View />;

    // A LIVE PRODUCT WITH NO LOG OF ITS OWN (MESITA-1987). On the activity
    // surface, "Not here yet" would be a lie about the Answering Agent: it IS
    // here, it simply records nothing separately. Saying where its events land
    // is the honest version, and it is what stops an operator hunting for a
    // screen that was never going to exist.
    //
    // The Developers Platform used to land here too and now says the same thing
    // inside its OWN view's Activity half, because it has a Manage half worth
    // drawing (MESITA-1992). The sentence is deliberately the same shape: the
    // reason is the same reason.
    if (half === "activity" && card.state !== "soon") {
      return (
        <div className="flex min-h-[45vh] flex-col items-center justify-center gap-3 text-center">
          <span aria-hidden className="text-4xl leading-none opacity-60">
            {PRODUCT_MARK[card.key]}
          </span>
          <p className="font-display text-sm font-semibold tracking-tight">
            No log of its own
          </p>
          <p className="text-muted-foreground max-w-[42ch] text-[13px] leading-snug">
            {card.name} is on here and keeps no log of its own. What it
            touches is recorded by the product that owns it — an order, a
            visit, a booking — and shows up on that product&apos;s Activity.
          </p>
        </div>
      );
    }
    if (card.key === "customers") {
      // NO DIAL HERE ANY MORE (MESITA-1997). Customer Intelligence moved
      // inside Mesita Ultra, so the thing that opens this catalog is the
      // RUNG — and a switch on the product that silently moved the plan
      // would be a second writer for a fact the ladder already owns.
      return (
        <p className="text-muted-foreground max-w-[54ch] text-[13px] leading-snug">
          The catalog opens with Mesita Ultra. Below it the list is counted and
          nobody in it is named — this place reads how many guests it has, not
          who they are.
        </p>
      );
    }
    // A STATED ABSENCE, COMPOSED (MESITA-1983). This was a dashed strip pinned
    // to the top of the pane, under a heading that had just said the same
    // sentence — a scrap at the top of half a white screen, which is what made
    // the products without a screen look unfinished rather than unbuilt.
    //
    // It is centred in the pane's own height now and it says ONE thing. The
    // mark is the product's, at the size the pane can afford: the thing the
    // operator clicked is the thing that greets them, which is the difference
    // between a blank panel and a page about a product that is not here yet.
    return (
      <div className="flex min-h-[45vh] flex-col items-center justify-center gap-3 text-center">
        <span aria-hidden className="text-4xl leading-none opacity-60">
          {PRODUCT_MARK[card.key]}
        </span>
        <p className="font-display text-sm font-semibold tracking-tight">
          {half === "activity" ? "Nothing to record yet" : "Not here yet"}
        </p>
        <p className="text-muted-foreground max-w-[42ch] text-[13px] leading-snug">
          {card.note ?? card.blurb}
        </p>
      </div>
    );
  }, [
    View,
    half,
    place,
    router,
    card.key,
    card.name,
    card.state,
    card.note,
    card.blurb,
  ]);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        mark={PRODUCT_MARK[card.key]}
        title={card.name}
        badges={<ProductStateBadge state={card.state} />}
        blurb={card.blurb}
        // THE NOTE, ONCE (MESITA-1983). A Soon product's note IS the
        // SoonStrip's body below, so printing it here too put the same
        // sentence on the screen twice, eleven words apart — which is how a
        // pane with one fact in it manages to look padded. It renders only
        // when something else is carrying the body.
        note={card.note && hasBody ? card.note : undefined}
        // THE HALVES, ON THE PRODUCT (MESITA-2004). Pato: *"AND EACH PRODUCT
        // IS DIVIDED INTO SETUP AND ACTIVITY."*
        //
        // IT DRAWS ONLY WHERE THERE ARE TWO. `isSplit` is four of the nine,
        // and on the other five there is no pair at all — not one tab, not two
        // with one dead. `TopNav` wrote the law this keeps after `TopNav`
        // itself was deleted: a destination a caller cannot reach is NOT
        // RENDERED. A pair that did nothing on five screens out of nine is a
        // control an operator learns to stop pressing, and then does not press
        // on the four where it works.
        tabs={
          half !== null && isSplit(card.key) ? (
            <HalfTabs productKey={card.key} current={half} />
          ) : undefined
        }
      />

      {body}
    </div>
  );
}

const HALF_LABEL: Record<PlaceHalf, string> = {
  // "Setup", not "Manage". `Half`'s own vocabulary still says `Manage` because
  // that is the string every view's JSX is written against and renaming it is a
  // sweep through eleven files; what the OPERATOR reads is this, and it is the
  // word MESITA-2001 settled on for the pair — Setup / Activity is how it is
  // configured beside what it did. Manage / Activity is a verb beside a noun.
  products: "Setup",
  activity: "Activity",
};

const HALVES: readonly PlaceHalf[] = ["products", "activity"];

function HalfTabs({
  productKey,
  current,
}: {
  productKey: ProductKey;
  current: PlaceHalf;
}) {
  const pathname = usePathname();
  const placeId = placeIdFromPathname(pathname);
  if (!placeId) return null;
  const slug = PRODUCT_SLUG[productKey];

  return (
    <HeaderTabs>
      {HALVES.map((h) => (
        <Link
          key={h}
          href={productHref(placeId, h, slug)}
          aria-current={h === current ? "page" : undefined}
          className={cn(
            HEADER_TAB,
            h === current ? HEADER_TAB_ACTIVE : HEADER_TAB_REST,
          )}
        >
          {HALF_LABEL[h]}
        </Link>
      ))}
    </HeaderTabs>
  );
}
