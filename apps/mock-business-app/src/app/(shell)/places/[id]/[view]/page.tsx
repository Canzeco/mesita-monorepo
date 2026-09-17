"use client";

// ONE FILE FOR THE NINE VIEWS.
//
// `PLACE_TABS` is the contract; this page is `PlaceTabGate`. A segment outside
// the contract 404s, and a segment inside it that this caller may not open 404s
// too — because a view reachable by typing its address is a view, whatever the
// rail chose to draw. That is the whole reason the gate is a page and not a
// conditional in the rail.
//
// The four PAGES under a place (settings, activity, products, customers) are
// static folders beside this dynamic one, and a static segment wins — so they
// never reach here.
import { use } from "react";
import { notFound } from "next/navigation";
import { usePlaceScope } from "@/components/console/PlaceScope";
import { PLACE_TABS, type PlaceTab } from "@/lib/place-tabs";
import { ProfileView } from "@/components/views/ProfileView";
import { VisitsView } from "@/components/views/VisitsView";
import { OrdersView } from "@/components/views/OrdersView";
import { ReservationsView } from "@/components/views/ReservationsView";
import { RewardsView } from "@/components/views/RewardsView";
import { PayView } from "@/components/views/PayView";
import { CreditsView } from "@/components/views/CreditsView";
import { CapitalView } from "@/components/views/CapitalView";
import { AdminView } from "@/components/views/AdminView";

const VIEWS: Record<PlaceTab, () => React.ReactElement | null> = {
  profile: ProfileView,
  visits: VisitsView,
  orders: OrdersView,
  reservations: ReservationsView,
  rewards: RewardsView,
  pay: PayView,
  credits: CreditsView,
  capital: CapitalView,
  admin: AdminView,
};

export default function PlaceViewPage({ params }: { params: Promise<{ view: string }> }) {
  const { view } = use(params);
  const { tabs } = usePlaceScope();

  if (!(PLACE_TABS as readonly string[]).includes(view)) notFound();
  const tab = view as PlaceTab;
  if (!tabs.includes(tab)) notFound();

  // THE VIEW IS THE WHOLE PAGE (MESITA-1943). The heading that stood here said
  // the place's name, its photo and this view's label — all three of which the
  // rail says, 240px left, at the same moment. It also had to invent a subject
  // for a POOL place, and what it invented was `verified: true` on a place
  // nobody had checked.
  const View = VIEWS[tab];
  return <View />;
}
