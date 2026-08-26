"use client";

import { ShoppingBag } from "lucide-react";
import { EmptyState } from "@/components/shared";

// Inbox › Orders — the section exists, the concept does not yet.
//
// Parked ON PURPOSE, and parked differently from Catalog: Catalog is a live
// Home mode over the shared deck. Orders has NO backing concept anywhere in
// the stack — no table, no Edge Function, no type — so there is nothing to
// redirect to and nothing to render. The section stays reachable and says so
// plainly rather than 404ing or vanishing from the nav, because the
// four-section order is the product statement and a gap in it would read as
// a bug.
//
// Un-parking is a backend job first: an order is the Mesita agent PHONING the
// place with a free-text request (not a delivery-app handoff), so it needs an
// order object with its own lifecycle before this screen can list anything.
export default function InboxOrdersPage() {
  return (
    <EmptyState
      icon={ShoppingBag}
      title="Orders are coming"
      description="Order from any place by telling the Mesita agent what you want — no menu needed. It calls the place and confirms. Your orders will land here."
    />
  );
}
