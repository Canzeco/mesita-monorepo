"use client";

// THE FLAT NAMES — one file, resolving all of them.
//
// `/profile`, `/orders`, `/settings` and the rest name a VIEW without naming a
// place. They exist for bookmarks, typed URLs and links written before the
// address carried an id; the rail links the canonical address, so a click never
// comes through here.
//
// The resolution is a 307, never a 308: which place a flat name means depends on
// what the operator last opened, and a browser that cached the answer would keep
// opening the wrong venue. Nothing selected → the door that creates one. A name
// outside the contract → 404, on purpose, so a typo never renders a generic
// page that looks like it worked.
import { use, useEffect } from "react";
import { notFound, useRouter } from "next/navigation";
import {
  FLAT_ROUTE_LIST,
  SHELL_ROUTES,
  flatPlacePageFromPathname,
  flatViewFromPathname,
  placePageHref,
} from "@/lib/console-routes";
import { placeTabHref } from "@/lib/place-tabs";
import { useMock } from "@/mock/MockStore";

export default function FlatRoute({ params }: { params: Promise<{ flat: string }> }) {
  const { flat } = use(params);
  const router = useRouter();
  const { world, lastPlaceId, hydrated } = useMock();

  const known = FLAT_ROUTE_LIST.includes(`/${flat}`);
  const view = flatViewFromPathname(`/${flat}`);
  const page = flatPlacePageFromPathname(`/${flat}`);

  useEffect(() => {
    if (!known || !hydrated) return;
    const held = world.places.find((p) => p.id === lastPlaceId);
    // NEVER PICK ONE SILENTLY. A caller holding several and nothing remembered
    // gets the list; `places[0]` is a place they never chose, and `/profile` is
    // a form.
    const target = held ?? (world.places.length === 1 ? world.places[0] : null);
    if (!target) {
      router.replace(world.places.length === 0 ? SHELL_ROUTES.placesNew : SHELL_ROUTES.places);
      return;
    }
    router.replace(
      page ? placePageHref(target.id, page) : placeTabHref(target.id, view!),
    );
  }, [known, hydrated, world, lastPlaceId, router, view, page]);

  if (!known) notFound();

  return (
    <p className="text-muted-foreground text-sm" role="status">
      Opening…
    </p>
  );
}
