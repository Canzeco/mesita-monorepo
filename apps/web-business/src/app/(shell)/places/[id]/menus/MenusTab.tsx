"use client";

// Menus — what this place serves, as its own view (MESITA-1848).
//
// It is not new. `MenusSection` has been built and live since the console had
// one Place screen; what it lacked was an ADDRESS. It rendered as the last
// child inside `PlaceSection` on Profile, below basics, location, hours,
// channels and photos — so the one artefact a guest actually reads was a
// scroll position at the bottom of the longest form in the console.
//
// Pato's 2026-09-14 list gives it a row, and a row whose destination is a
// scroll position on another page is a row that lies about where it goes.
// Same split, same reasoning as Rewards out of Capabilities (MESITA-1841):
// the component does not change, the address does.
//
// It stays in the READ set of the tab matrix rather than joining the two that
// write (Capabilities, Rewards): every held role could open it while it lived
// inside Profile, and splitting a view out must not quietly take a surface
// away from a viewer.
import { MenusSection } from "@/components/place-manage/sections/MenusSection";
import { usePlaceContext } from "@/components/place-manage/PlaceContext";

export function MenusTab() {
  const { place } = usePlaceContext();
  return (
    <div className="flex flex-col gap-4">
      <MenusSection key={place.id} place={place} />
    </div>
  );
}
