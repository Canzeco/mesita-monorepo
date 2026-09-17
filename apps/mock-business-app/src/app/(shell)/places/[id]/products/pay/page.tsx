"use client";

// Online Payments' Stripe account — a SUB-STEP of the catalogue, not a ninth
// card. It is also where Stripe's stored `return_url` lands, which is why the
// bare place address forwards its whole query here.
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { NotHeld, useHeldPlaceOrNull, usePlaceScope } from "@/components/console/PlaceScope";
import { PayView } from "@/components/views/PayView";
import { placePageHref } from "@/lib/console-routes";
import { QUIET_LINK_BUTTON_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

export default function ProductsPayPage() {
  const place = useHeldPlaceOrNull();
  const { pages } = usePlaceScope();
  // THE GATE THESE PAGES WERE MISSING. They are static segments beside
  // `[view]`, so no tab gate ever runs for them: a pool id typed into the bar,
  // or the scenario flipped to a failed read while one of them was open, used
  // to reach the body with no place at all. It sits after the hooks and before
  // the first `place.` — a guard below a dereference is not a guard.
  if (!place) return <NotHeld />;
  // AND HELD AS WHAT (MESITA-1933). `NotHeld` above answers "is this place
  // held"; it has never answered the role, and until now nothing did for this
  // page — the rail's product rows were running `tabsForAccess` and that was
  // the whole console's role check. The rows are gone, so the gate is here.
  // `notFound`, like `PlaceTabGate`: a page reachable by typing its address is
  // a page, whatever the rail chose to draw.
  if (!pages.includes("products")) notFound();

  return (
    <>
      {/* A DOOR, NOT A HEADING (MESITA-1943). The heading that stood here went
          with the other six, but this page is the one that cannot lose its
          label for free: it is the only address under a place that NO rail row
          points at, and Stripe's stored `return_url` drops an owner on it weeks
          after they minted the link. `PayView`'s own title is the ladder state
          ("Payments are live"), which answers what is happening and not where
          you are. So what comes back is the half the rail cannot say — the
          parent and the way up — and not the half it already does. */}
      {/* `self-start`, because the shell's column STRETCHES its children and
          `QUIET_LINK_BUTTON_CLASS` carries a 44px `::after` tap target sized
          `inset-x-0`. Left to stretch, that invisible target is 976px of
          clickable page for a link eight characters wide. */}
      <Link
        href={placePageHref(place.id, "products")}
        className={cn(QUIET_LINK_BUTTON_CLASS, "self-start")}
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
        Products
      </Link>
      <PayView />
    </>
  );
}
