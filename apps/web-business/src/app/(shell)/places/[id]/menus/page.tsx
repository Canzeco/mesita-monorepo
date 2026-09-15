// Menus — THE PLACE's menus, split out of Profile in MESITA-1848.
//
// The gate is the place's own: a URL is not a capability (the ONE matrix,
// lib/place-tabs). Menus sits with Profile and Reviews in the read set, so a
// viewer keeps the surface they already had when it was Profile's last card.
//
// THE GATE IS STILL THERE; IT IS JUST NOT HERE (MESITA-1875). This page used
// to `Promise.all([getPlaceView, getManagePlace])` and then render `<MenusTab
// />` with no props — two Edge Function calls spent on a boolean, on every
// navigation to this tab, because `cache()` dedupes within a request and a
// sibling navigation is a new one. `PlaceTabGate` in the layout answers 404
// from the matrix the layout already resolved.
import { MenusTab } from "./MenusTab";

export default function MenusPage() {
  return <MenusTab />;
}
