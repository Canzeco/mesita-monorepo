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
import { PlaceHeading } from "@/components/console/PlaceHeading";
import { PLACE_TABS, PLACE_TAB_LABEL, type PlaceTab } from "@/lib/place-tabs";
import { ProfileView } from "@/components/views/ProfileView";
import { VisitsView } from "@/components/views/VisitsView";
import { OrdersView } from "@/components/views/OrdersView";
import { ReservationsView } from "@/components/views/ReservationsView";
import { RewardsView } from "@/components/views/RewardsView";
import { PayView } from "@/components/views/PayView";
import { CreditsView } from "@/components/views/CreditsView";
import { AdminView } from "@/components/views/AdminView";

const VIEWS: Record<PlaceTab, () => React.ReactElement | null> = {
  profile: ProfileView,
  visits: VisitsView,
  orders: OrdersView,
  reservations: ReservationsView,
  rewards: RewardsView,
  pay: PayView,
  credits: CreditsView,
  admin: AdminView,
};

export default function PlaceViewPage({ params }: { params: Promise<{ view: string }> }) {
  const { view } = use(params);
  const { place, pool, tabs } = usePlaceScope();

  if (!(PLACE_TABS as readonly string[]).includes(view)) notFound();
  const tab = view as PlaceTab;
  if (!tabs.includes(tab)) notFound();

  const View = VIEWS[tab];
  const subject = place ?? (pool
    ? { ...pool, photoUrl: null, verified: true, partnered: false, promoting: false }
    : null);

  return (
    <>
      {subject && <PlaceHeading place={subject} view={PLACE_TAB_LABEL[tab]} />}
      <View />
    </>
  );
}
