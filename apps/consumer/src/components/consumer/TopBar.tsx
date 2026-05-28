"use client";

import { usePathname } from "next/navigation";
import { SimpleHeader } from "./SimpleHeader";
import { DiscoverHeader } from "./DiscoverHeader";

// Route-driven top chrome for the consumer shell.
//
// Uniform 3-column structure on every top-level surface:
//
//   [Peacock logo · 40px]   [Center column]   [Class chip · 40px]
//
// SimpleHeader puts the page title in the center column.
// DiscoverHeader puts the WHAT/WHERE/WHEN picker in the center column.
// Both share h-16 (64px) so the body band size is identical across
// every route (no shifting when tabbing between Discover and the
// other surfaces).
//
// Per-route policy:
//   /discover/*    DiscoverHeader (3-pill picker in the center)
//   /reservations  SimpleHeader title="Reservations"
//   /coupons       SimpleHeader title="Coupons"
//   /pay           SimpleHeader title="Pay"
//   /share         SimpleHeader title="Share"
//   /profile       SimpleHeader title="Profile"
//   everything     null — Subscribe / Venue pages ship their own
//     else         back-arrow chrome and opt out by not matching.
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
    return <SimpleHeader title="Share" />;
  }
  if (pathname.startsWith("/profile")) {
    return <SimpleHeader title="Profile" />;
  }
  return null;
}
