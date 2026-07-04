"use client";

import { usePathname } from "next/navigation";
import { SimpleHeader } from "./SimpleHeader";
import { DiscoverHeader } from "./DiscoverHeader";
import {
  CONSUMER_ROUTES,
  CONSUMER_ROUTE_PREFIX,
} from "@/lib/consumer-route-contract";

// Route-driven top chrome for the consumer shell.
export function TopBar({ userName }: { userName?: string | null }) {
  const pathname = usePathname() ?? "";

  // Home and Search own their top UI (mode pill nav / floating search bar),
  // so the shell renders no chrome band for them.
  if (
    pathname.startsWith(CONSUMER_ROUTE_PREFIX.home) ||
    pathname.startsWith(CONSUMER_ROUTE_PREFIX.search)
  ) {
    return null;
  }
  if (pathname.startsWith(CONSUMER_ROUTE_PREFIX.explore)) {
    return <DiscoverHeader />;
  }
  // The Reservations tab points at the saved-reservations surface; title it
  // after the tab, not the legacy Saved section. Singular prefix also covers
  // /saved/reservation/[id] details.
  if (pathname.startsWith("/saved/reservation")) {
    return <SimpleHeader title="Reservations" />;
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
  if (pathname.startsWith(CONSUMER_ROUTE_PREFIX.pay)) {
    return <SimpleHeader title="QR" rightAction="share" />;
  }
  if (
    pathname.startsWith("/invite") ||
    pathname.startsWith(CONSUMER_ROUTES.share)
  ) {
    return <SimpleHeader title="Invite" />;
  }
  if (
    pathname.startsWith(CONSUMER_ROUTE_PREFIX.me) ||
    pathname.startsWith(CONSUMER_ROUTES.legacy.profile)
  ) {
    return (
      <SimpleHeader title={userName?.trim() || "Profile"} rightAction="share" />
    );
  }
  return null;
}
