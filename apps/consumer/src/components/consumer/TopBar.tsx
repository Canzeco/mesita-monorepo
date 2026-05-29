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
//   /saved         SimpleHeader title="My Saved Places"
//   /pay           SimpleHeader title="Pay & Post"
//   /reservations  SimpleHeader title="My Reservations"
//   /share         SimpleHeader title="Share Mesita" (Profile > Share is
//                  the primary entry)
//   /profile       SimpleHeader title=<first name + last name>
//   everything     null — Subscribe / Venue pages ship their own
//     else         back-arrow chrome and opt out by not matching.
export function TopBar({ userName }: { userName?: string | null }) {
  const pathname = usePathname() ?? "";

  if (pathname.startsWith("/discover")) return <DiscoverHeader />;
  if (pathname.startsWith("/saved")) {
    return <SimpleHeader title="My Saved Places" />;
  }
  if (pathname.startsWith("/reservations")) {
    return <SimpleHeader title="My Reservations" />;
  }
  if (pathname.startsWith("/pay")) {
    return <SimpleHeader title="Pay & Post" />;
  }
  if (pathname.startsWith("/share")) {
    return <SimpleHeader title="Share Mesita" />;
  }
  if (pathname.startsWith("/profile")) {
    // Personalize the Profile chrome with the consumer's full name.
    // Layout passes the prop after fetching the consumer profile —
    // falls back to the literal "Profile" if the name isn't available
    // (legacy rows without first/last set, or the EF failed).
    return <SimpleHeader title={userName?.trim() || "Profile"} />;
  }
  return null;
}
