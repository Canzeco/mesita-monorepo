"use client";

import { usePathname } from "next/navigation";
import { SimpleHeader } from "./SimpleHeader";
import { DiscoverHeader } from "./DiscoverHeader";

// Route-driven top chrome for the consumer shell.
//
// The shell layout mounts <TopBar /> as a sibling above the children
// container so the header lives OUTSIDE the page's scroll area —
// architecturally enforced "never scrolls", not just by convention.
// BottomNav already gets the same treatment at the bottom of the shell.
//
// Per-route policy:
//   - /discover/*    DiscoverHeader (What/Where/When picker). The
//                    discover/layout.tsx adds DiscoverTabs below it as
//                    its own non-scrolling band.
//   - /reservations  SimpleHeader title="Reservations"
//   - /coupons       SimpleHeader title="Coupons"
//   - /pay           SimpleHeader title="Pay"
//   - /share         SimpleHeader title="Mesita" + "Share with friends"
//   - everything     null — these surfaces ship their own chrome
//     else           (Profile's avatar hero, Subscribe + Venue back
//                    headers). Pages that need different chrome opt out
//                    by not matching here.
//
// Adding a new top-level route? Add a branch here AND drop any inline
// SimpleHeader from that page so the layout owns the slot.

export function TopBar() {
  const pathname = usePathname() ?? "";

  if (pathname.startsWith("/discover")) return <DiscoverHeader />;
  if (pathname.startsWith("/reservations")) {
    return <SimpleHeader title="Reservations" />;
  }
  if (pathname.startsWith("/coupons")) {
    return <SimpleHeader title="Coupons" />;
  }
  if (pathname.startsWith("/pay")) {
    return <SimpleHeader title="Pay" />;
  }
  if (pathname.startsWith("/share")) {
    return <SimpleHeader title="Mesita" eyebrow="Share with friends" />;
  }
  return null;
}
