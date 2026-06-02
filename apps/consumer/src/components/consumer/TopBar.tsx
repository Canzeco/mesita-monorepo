"use client";

import { usePathname } from "next/navigation";
import { SimpleHeader } from "./SimpleHeader";
import { DiscoverHeader } from "./DiscoverHeader";

// Route-driven top chrome for the consumer shell.
export function TopBar({ userName }: { userName?: string | null }) {
  const pathname = usePathname() ?? "";

  if (pathname.startsWith("/explore")) {
    return <DiscoverHeader />;
  }
  if (pathname.startsWith("/inbox") || pathname.startsWith("/notifications")) {
    return <SimpleHeader title="Inbox" rightAction="share" />;
  }
  if (pathname.startsWith("/saved")) {
    return <SimpleHeader title="Saved" rightAction="share" />;
  }
  if (pathname.startsWith("/reservations")) {
    return <SimpleHeader title="My Reservations" />;
  }
  if (pathname.startsWith("/pay")) {
    return <SimpleHeader title="Pay" rightAction="share" />;
  }
  if (pathname.startsWith("/invite") || pathname.startsWith("/share")) {
    return <SimpleHeader title="Invite" rightAction="share" />;
  }
  if (pathname.startsWith("/profile")) {
    return (
      <SimpleHeader
        title={userName?.trim() || "Profile"}
        rightAction="share"
      />
    );
  }
  return null;
}
