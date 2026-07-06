"use client";

import { usePathname } from "next/navigation";
import { SimpleHeader } from "./SimpleHeader";
import { MeHeaderTitle } from "./MeHeaderTitle";
import {
  CONSUMER_RESERVATION_SURFACE_PREFIX,
  CONSUMER_ROUTES,
  CONSUMER_ROUTE_PREFIX,
} from "@/lib/consumer-route-contract";

// Route-driven top chrome for the consumer shell.
export function TopBar() {
  const pathname = usePathname() ?? "";

  // Home and Search own their top UI (mode pill nav / floating search bar),
  // so the shell renders no chrome band for them.
  if (
    pathname.startsWith(CONSUMER_ROUTE_PREFIX.home) ||
    pathname.startsWith(CONSUMER_ROUTE_PREFIX.search)
  ) {
    return null;
  }
  // The Reservations tab points at the saved-reservations surface; title it
  // after the tab, not the legacy Saved section. Singular prefix also covers
  // /saved/reservation/[id] details.
  if (pathname.startsWith(CONSUMER_RESERVATION_SURFACE_PREFIX)) {
    return <SimpleHeader title="Reservations" rightAction="share" />;
  }
  if (
    pathname.startsWith(CONSUMER_ROUTE_PREFIX.inbox) ||
    pathname.startsWith(CONSUMER_ROUTES.legacy.notifications)
  ) {
    return <SimpleHeader title="Inbox" rightAction="share" />;
  }
  if (pathname.startsWith(CONSUMER_ROUTE_PREFIX.saved)) {
    return <SimpleHeader title="Saved" rightAction="share" />;
  }
  if (pathname.startsWith("/reservations")) {
    return <SimpleHeader title="My Reservations" />;
  }
  // The pay surface is what the Rewards tab lands on — title it after the
  // tab so the header and the tab bar tell one story.
  if (pathname.startsWith(CONSUMER_ROUTE_PREFIX.pay)) {
    return <SimpleHeader title="Rewards" rightAction="share" />;
  }
  // The Invite page keeps the header share icon even though the page is all
  // share actions — the icon is part of the shell's standard chrome (Pato,
  // 2026-07-05: redundancy is fine).
  if (
    pathname.startsWith(CONSUMER_ROUTES.invite) ||
    pathname.startsWith(CONSUMER_ROUTES.legacy.share)
  ) {
    return <SimpleHeader title="Invite" rightAction="share" />;
  }
  // The Profile tab is titled "me" and carries the member's current class
  // (Free / Premium) inline — see MeHeaderTitle. The right-side ClassChip
  // stays as the tap-to-plan control.
  if (
    pathname.startsWith(CONSUMER_ROUTE_PREFIX.me) ||
    pathname.startsWith(CONSUMER_ROUTES.legacy.profile)
  ) {
    return <SimpleHeader title={<MeHeaderTitle />} rightAction="share" />;
  }
  return null;
}
