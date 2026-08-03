"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { forgetSavedPlace } from "@/lib/saved-places";
import { toast } from "@/lib/toast";

// Explains the place-detail bounce.
//
// The four place-detail routes (place / saved-place × page / intercepted
// modal) all resolve the place server-side and `redirect()` home when
// consumer-web-get-place 404s. That fallback is right — the app has no error
// boundary and a hard 500 on a dead id is worse — but on its own it is
// SILENT: the guest taps a place and simply lands back on Home with no idea
// why. Reported as "a mistake is occurring, I cannot observe the place".
//
// A dead id is routine, not exotic: favorites live in localStorage
// (`useSavedPlaces`), so they outlive the row they point at — an
// admin-web-reset-database run leaves every saved tile pointing at a place
// that no longer exists. Same for an open tab or a bookmark.
//
// So the redirect now carries `?gone=<id>` and this component, mounted once
// in the shell, turns it into (a) a stated reason and (b) a self-heal: the
// dead id is dropped from the saved set and its cached preview, so the ghost
// tile that caused the bounce disappears instead of waiting to bounce again.
// The param is stripped afterwards so a refresh doesn't re-toast.
//
// The self-heal has to cover BOTH stores of dead ids. Favorites live in
// localStorage (forgetSavedPlace). The Home deck lives in the /home layout's
// server fetch, which by design never re-runs on tab navigation — so after a
// DB reset an open tab keeps dealing cards whose rows are gone, and every tap
// bounces right back here. router.refresh() re-runs the layout's server
// components, so the deck is refetched and the dead card stops existing too.
export function PlaceGoneNotice() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const gone = params.get("gone");

  useEffect(() => {
    if (!gone) return;
    // Drop the dangling id so the tile that bounced us stops existing.
    forgetSavedPlace(gone);
    toast("That place isn't on Mesita anymore", { tone: "error" });
    // Strip `gone` but keep any other params the destination cares about.
    const next = new URLSearchParams(params.toString());
    next.delete("gone");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    // Refetch the layout's server-provided data (the Home deck) so the card
    // that pointed at the dead row is dealt out of existence.
    router.refresh();
  }, [gone, params, pathname, router]);

  return null;
}
