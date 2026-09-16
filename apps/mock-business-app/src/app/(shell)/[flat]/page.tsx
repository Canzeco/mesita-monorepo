"use client";

// THE FLAT NAMES — one file, resolving all of them.
//
// `/profile`, `/orders`, `/products` and the rest name a VIEW without naming a
// place. They exist for bookmarks, typed URLs and links written before the
// address carried an id; the rail links the canonical address, so a click never
// comes through here.
//
// `/settings` IS NO LONGER ONE OF THEM (MESITA-1935). It is a real page now —
// the person's Settings — and a static segment beats `[flat]` in the router, so
// it would never have reached this file anyway. It left `FLAT_ROUTES` rather
// than sitting there as a line that resolves nothing.
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
  isFlatHome,
  placePageHref,
  placeRootHref,
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
  // `/home` is neither, and both readers above return null for it on purpose —
  // it means the place's BARE address, which is the one flat name with no
  // segment after the id.
  const home = isFlatHome(`/${flat}`);

  useEffect(() => {
    if (!known || !hydrated) return;
    const held = world.places.find((p) => p.id === lastPlaceId);
    // NEVER PICK ONE SILENTLY. A caller holding several and nothing remembered
    // gets the list; `places[0]` is a place they never chose.
    const target = held ?? (world.places.length === 1 ? world.places[0] : null);
    if (!target) {
      // A FAILED READ IS NOT AN EMPTY PORTFOLIO, and `world.places` is empty
      // for both. Landing `unknown` on the Add ceremony would tell an operator
      // they hold nothing on the morning the read merely did not happen — the
      // one sentence this whole app's law forbids. The catalogue is where a
      // failed read goes, because it is the only screen that can SAY so.
      router.replace(
        world.viewerError || world.places.length > 0
          ? SHELL_ROUTES.places
          : SHELL_ROUTES.placesNew,
      );
      return;
    }
    router.replace(
      home
        ? placeRootHref(target.id)
        : page
          ? placePageHref(target.id, page)
          : placeTabHref(target.id, view!),
    );
  }, [known, hydrated, world, lastPlaceId, router, view, page, home]);

  if (!known) notFound();

  return (
    <p className="text-muted-foreground text-sm" role="status">
      Opening…
    </p>
  );
}
