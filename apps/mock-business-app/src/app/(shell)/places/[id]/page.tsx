"use client";

// THE PLACE'S OWN SCREEN — what needs you, and the bar you ask (MESITA-2006).
//
// ── IT WAS A REDIRECT, AND THAT IS WHY THIS IS HERE ────────────────────────
//
// `/places/<id>` has spent three issues doing nothing but `router.replace` onto
// the catalogue. Meanwhile `NeedsYou` — the Ask bar, the blockers, the four
// counts — has been HOMELESS twice: MESITA-1976 took the place's Home screen
// away when Place went back to being a switcher, and MESITA-1988 parked it at
// the top of the whole-place log because that was the only screen left that
// was about the place rather than about a product.
//
// Pato deleted that log in this issue. Deleting it silently would have taken
// the Ask bar with it — the composer, its four openers and every scripted
// answer — because the log page was the ONLY thing that mounted `NeedsYou`.
// That is not what "delete the activity screen" asked for: the log and the bar
// were two surfaces sharing a host, not one screen.
//
// So the bar gets the address that was already waiting for it. This is the
// place's own screen and it always should have been:
//
//   * THE SIDEBAR ALREADY LIGHTS HERE. `isPlaceHomePathname` is in the Place
//     row's `on` test, written when Place became the switcher — picking a place
//     out of the portfolio lands you on `/places/<id>` and the tab you came
//     from must not go dark underneath you (MESITA-1976).
//   * EVERY "OPEN THIS PLACE" PATH ALREADY COMES THROUGH IT, which is why the
//     redirect existed at all.
//
// ── WHAT DID NOT COME BACK ─────────────────────────────────────────────────
//
// THE LOG. `mock/logs.ts` and `lib/csv.ts` went with the page — nothing else
// imported either. `PLACE_VIEWS`, `SETTING_CHANGES` and `CREDIT_PURCHASES` are
// now read by nobody; they stay in `fixtures.ts` because that file is this
// app's DATABASE and the first per-product Activity pane that wants views or
// purchases will want them exactly as they are.
//
// ── THE STRIPE RETURN STILL REDIRECTS ──────────────────────────────────────
//
// `?connect=` is Stripe handing the operator back after a hosted onboarding
// round trip, and it is addressed to the Payments screen. It arrives here only
// because this is the place's root, so it is forwarded rather than rendered —
// a return notice on a screen that cannot show the account it is about is a
// notice about nothing.
import { use, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { NeedsYou } from "@/components/console/NeedsYou";
import { PageHeader } from "@/components/console/PageHeader";
import { PlaceChip } from "@/components/console/PlaceChip";
import { NotHeld, useHeldPlaceOrNull } from "@/components/console/PlaceScope";
import { ORDERS, RESERVATIONS, REVIEWS, VISITS } from "@/mock/fixtures";
import { listFor } from "@/mock/scenario";
import { useMock } from "@/mock/MockStore";
import { placePayHref } from "@/lib/console-routes";

export default function PlaceRoot({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const connect = useSearchParams().get("connect");
  const place = useHeldPlaceOrNull();
  const { scenario, now } = useMock();

  useEffect(() => {
    if (!connect) return;
    router.replace(`${placePayHref(id)}?connect=${encodeURIComponent(connect)}`);
  }, [id, connect, router]);

  if (connect) {
    return (
      <p className="text-muted-foreground text-sm" role="status">
        Opening…
      </p>
    );
  }

  // THE GATE, after the hooks and before the first `place.`. A guard below a
  // dereference is not a guard, and this address is reachable by typing it —
  // a pool id, or the scenario flipped to a failed read while it was open.
  if (!place) return <NotHeld />;

  // NO ROLE GATE HERE, unlike the log this replaces. That page called
  // `notFound()` when `pages` lacked `"activity"`, which dropped a VIEWER at a
  // 404. A viewer holds this place and may read it; what they may not do is
  // configure it, and every door `NeedsYou` draws lands on a screen that
  // refuses them on its own. The place's own screen is the one address a
  // viewer should never be bounced from.
  const visits = listFor(VISITS.filter((v) => v.placeId === place.id), scenario);
  const orders = listFor(ORDERS.filter((o) => o.placeId === place.id), scenario);
  const reservations = listFor(
    RESERVATIONS.filter((r) => r.placeId === place.id),
    scenario,
  );
  const reviews = listFor(REVIEWS.filter((r) => r.placeId === place.id), scenario);

  return (
    <>
      {/* THE PLACE'S OWN SCREEN HAD NO HEADER (MESITA-2008). It opened on the
          Ask bar, so the venue's name appeared only in the menu's band. The
          mark here is the place's PHOTOGRAPH rather than a glyph — the one
          screen whose subject has a real picture — which is why `PageHeader`
          takes a node and not just a string. */}
      <PageHeader
        mark={<PlaceChip photoUrl={place.photoUrl} size="page" />}
        title={place.name}
        blurb="What needs you here, and the bar that does it for you."
      />
      <NeedsYou
        place={place}
        visits={visits}
        orders={orders}
        reservations={reservations}
        reviews={reviews}
        now={now}
      />
    </>
  );
}
