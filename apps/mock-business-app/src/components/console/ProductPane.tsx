"use client";

// THE RIGHT HALF OF SETUP — one product, open (MESITA-1981).
//
// Pato, 2026-09-18: *"setup here in the computer make it two screns, 50% and
// 50%. left to slect categoery, the same list. right to setup shit subpahe
// basically."*
//
// ── IT RENDERS THE REAL VIEW, IT DOES NOT REBUILD IT ───────────────────────
//
// Seven products have a screen — Profile, Visit Rewards, Online Orders, Online
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
// ── AND THE ELEVEN WITHOUT ONE ─────────────────────────────────────────────
//
// Pato picked the complete answer: every product gets a pane, Coming included.
// A list where eleven of eighteen rows do nothing when clicked teaches you that
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
import { useHalf } from "@/components/shared/Half";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { ProfileView } from "@/components/views/ProfileView";
import { MenuView } from "@/components/views/MenuView";
import { VisitsView } from "@/components/views/VisitsView";
import { OrdersView } from "@/components/views/OrdersView";
import { ReservationsView } from "@/components/views/ReservationsView";
import { RewardsView } from "@/components/views/RewardsView";
import { PayView } from "@/components/views/PayView";
import { CreditsView } from "@/components/views/CreditsView";
import { CapitalView } from "@/components/views/CapitalView";
import { ProductStateBadge } from "@/components/shared/Badges";
import { useMock } from "@/mock/MockStore";
import type { ProductCard } from "@/lib/products";
import type { ProductKey } from "@/lib/product-keys";
import { PRODUCT_MARK } from "@/lib/product-marks";
import { SCOPE_CHIP_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

/** THE SEVEN THAT HAVE A SCREEN. Keyed by PRODUCT key, not by `PlaceTab`:
 *  `pay`'s screen is `PayView` but its address is a sub-step rather than a tab,
 *  and `menu`'s door is Profile, which is somebody else's screen. A record over
 *  the product key says both of those out loud instead of hiding them behind a
 *  cast that happens to work. */
const PRODUCT_VIEW: Partial<Record<ProductKey, () => React.ReactElement | null>> = {
  profile: ProfileView,
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
};

/** Visit Rewards' own strategy screen, reached from `VisitsView`. Held here so
 *  the import is not dead weight the day a rewards row wants its own pane. */
void RewardsView;

function Dial({
  label,
  hint,
  on,
  onChange,
}: {
  label: string;
  hint: string;
  on: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="border-border bg-card flex items-start gap-3 rounded-2xl border p-4">
      <div className="min-w-0 flex-1">
        <p className="font-display text-sm font-semibold tracking-tight">{label}</p>
        <p className="text-muted-foreground mt-1 text-[12px] leading-snug">{hint}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        onClick={() => onChange(!on)}
        className={cn(
          "focus-visible:ring-ring relative h-6 w-11 shrink-0 rounded-full transition outline-hidden focus-visible:ring-2 focus-visible:ring-offset-2",
          on ? "bg-foreground" : "bg-muted border-border border",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "bg-card absolute top-1 h-4 w-4 rounded-full transition",
            on ? "left-6" : "left-1",
          )}
        />
      </button>
    </div>
  );
}

export function ProductPane({ card }: { card: ProductCard }) {
  const { scenario, setScenario } = useMock();
  const View = PRODUCT_VIEW[card.key] ?? null;
  /** Is the body something other than a restatement of the note? */
  const hasBody = View !== null || card.key === "customers";

  const half = useHalf();

  const body = useMemo(() => {
    if (View) return <View />;

    // A LIVE PRODUCT WITH NO LOG OF ITS OWN (MESITA-1987). On the activity
    // surface, "Not here yet" would be a lie about the Developers Platform and the
    // Answering Agent: they ARE here, they simply record nothing separately.
    // Saying where their events land is the honest version, and it is what
    // stops an operator hunting for a screen that was never going to exist.
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
            {card.name} is on here and records nothing separately. What it
            touches shows up in this place&apos;s whole log, one screen back.
          </p>
        </div>
      );
    }
    if (card.key === "customers") {
      return (
        <Dial
          label="Customer Intelligence"
          hint="While it runs, this place reads who its guests are and what they did this month. When it stops, the reading stops and the place keeps nothing."
          on={scenario.customerIntel}
          onChange={(customerIntel) => setScenario({ customerIntel })}
        />
      );
    }
    // A STATED ABSENCE, COMPOSED (MESITA-1983). This was a dashed strip pinned
    // to the top of the pane, under a heading that had just said the same
    // sentence — a scrap at the top of half a white screen, which is what made
    // eleven of eighteen products look unfinished rather than unbuilt.
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
    card.key,
    card.name,
    card.state,
    card.note,
    card.blurb,
    scenario.customerIntel,
    setScenario,
  ]);

  return (
    <div className="flex flex-col gap-4">
      {/* THE BACK DOOR IS MOBILE-ONLY. Below `lg` the two halves are one screen
          at a time — 50/50 does not exist on a 375px phone — so the pane needs
          a way back to the list. Above `lg` the list is on screen beside it and
          a back link would point at something already visible. */}
      <Link
        href="?"
        scroll={false}
        className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-[13px] font-medium lg:hidden"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
        All products
      </Link>

      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className={cn(
            SCOPE_CHIP_CLASS,
            "bg-muted text-foreground flex shrink-0 items-center justify-center",
          )}
        >
          <span className="text-[22px] leading-none">{PRODUCT_MARK[card.key]}</span>
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {/* `h2`, under Setup's own `h1`. The pane is a section of this
                page, not a page of its own, and an outline that restarts at
                h1 inside a column tells a rotor it moved when it did not. */}
            <h2 className="font-display text-lg font-semibold tracking-tight">
              {card.name}
            </h2>
            <ProductStateBadge state={card.state} />
          </div>
          <p className="text-muted-foreground mt-1 text-[13px] leading-snug">
            {card.blurb}
          </p>
          {/* THE NOTE, ONCE (MESITA-1983). A Soon product's note IS the
              SoonStrip's body below, so printing it here too put the same
              sentence on the screen twice, eleven words apart — which is how
              a pane with one fact in it manages to look padded. It renders
              here only when something else is carrying the body. */}
          {card.note && hasBody && (
            <p className="text-foreground mt-1 text-[13px] leading-snug font-medium">
              {card.note}
            </p>
          )}
        </div>
      </div>

      {body}
    </div>
  );
}
