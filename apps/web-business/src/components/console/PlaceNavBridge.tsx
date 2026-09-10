"use client";

// Hands the unsaved-edits guard UP to the rail (MESITA-1714).
//
// Replaces GuardedPlaceTabs, and exists for the same reason it did: this is a
// four-line component so that nothing else has to import PlaceContext from a
// place it might not be provided. `usePlaceContext` throws outside its
// provider, and a pool place has none.
//
// What changed is the DIRECTION. GuardedPlaceTabs pulled `guardNav` down into
// a tab row rendered right here. The tab rows live in the rail now — above the
// provider, where a context consumer cannot go — so instead of moving the
// component down, this moves the VALUE up. `guardNav` is a `useCallback` with
// deps `[isDirty, router]`, so it is render-stable and publishing it costs one
// effect, not one per render.
//
// MESITA-1710 D4 claimed the views could not live in the rail at all because
// of the provider's position. That was a wrong conclusion from a true premise:
// the position blocks rendering a consumer up there, not reaching the value.

import { usePlaceContext } from "@/components/place-manage/PlaceContext";
import { PublishPlaceNav } from "@/components/console/OpenPlace";

export function PlaceNavBridge() {
  const { guardNav } = usePlaceContext();
  return <PublishPlaceNav guardNav={guardNav} />;
}
