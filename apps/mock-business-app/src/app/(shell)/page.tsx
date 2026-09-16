"use client";

// `/` IS A RESOLVER, and it is a 307 in the real console — never a 308.
//
// Where it lands depends on what the caller holds, and that answer changes:
// today's one place becomes tomorrow's four, and a browser that cached a
// permanent redirect would keep opening a place the operator no longer works
// at. Here the same rule shows up as `router.replace`, which leaves no history
// entry — Back from Profile must go where the operator came from, not bounce
// off this page and forward again.
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { SHELL_ROUTES } from "@/lib/console-routes";
import { placeTabHref } from "@/lib/place-tabs";
import { useMock } from "@/mock/MockStore";

export default function ConsoleRoot() {
  const router = useRouter();
  const { world, lastPlaceId, hydrated } = useMock();

  useEffect(() => {
    // Wait for the stored scenario: replacing on the default and again on the
    // restored one would send the operator to two different places in one
    // frame, and the second hop is the one they would see.
    if (!hydrated) return;

    if (world.viewerError) {
      // A FAILED READ LANDS ON THE CATALOGUE, not on a place. There is no place
      // it could name, and the catalogue is the one screen whose whole job is
      // to say what it could and could not read.
      router.replace(SHELL_ROUTES.places);
      return;
    }
    if (world.places.length === 0) {
      router.replace(SHELL_ROUTES.placesNew);
      return;
    }
    const remembered = world.places.find((p) => p.id === lastPlaceId);
    // A portfolio of several with nothing remembered gets the LIST. The console
    // does not pick one: `places[0]` is a place the operator never chose, and
    // Profile is a form.
    const target = remembered ?? (world.places.length === 1 ? world.places[0] : null);
    router.replace(target ? placeTabHref(target.id, "profile") : SHELL_ROUTES.places);
  }, [hydrated, world, lastPlaceId, router]);

  return (
    <p className="text-muted-foreground text-sm" role="status">
      Opening the console…
    </p>
  );
}
