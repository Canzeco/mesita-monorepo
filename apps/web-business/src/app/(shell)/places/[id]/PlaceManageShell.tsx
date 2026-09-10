"use client";

// The client half of the Place screen (MESITA-1537): it owns the AdminPlace
// state the ported sections read through PlaceContext, and the one-save bar.
//
// Admin's PlaceEditChrome is deliberately NOT ported: it repeats operator
// state a restaurant may not see, it links to /manage-single/select (a 404
// here), and it polls enrichment every 8-60s from every tab. The rail is the
// chrome (MESITA-1714).
//
// `PlaceNavBridge` is rendered HERE, not by the caller, because it has to be
// INSIDE PlaceProvider to read guardNav — and "inside" as a JSX-position
// convention is enforced by nothing. usePlaceContext throws, so a later edit
// that moved it one line up would crash every managed place, past tsc, eslint
// and the tests. Rendering it ourselves makes the position structural.
//
// It used to be a `header` prop for the same reason, back when the thing that
// needed the provider was a bar full of tabs. The bar is gone; only the guard
// still needs to be in here, and it renders nothing.

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { PlaceProvider } from "@/components/place-manage/PlaceContext";
import { PlaceUIProvider } from "@/components/place-manage/PlaceUIContext";
import { PlaceSaveBar } from "@/components/place-manage/PlaceSaveBar";
import { PlaceNavBridge } from "@/components/console/PlaceNavBridge";
import type { AdminPlace } from "@/components/place-manage/actions";

export function PlaceManageShell({
  placeId,
  initialPlace,
  children,
}: {
  placeId: string;
  initialPlace: AdminPlace;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [place, setPlace] = useState<AdminPlace>(initialPlace);
  const reload = useCallback(() => router.refresh(), [router]);

  return (
    <PlaceProvider
      placeId={placeId}
      place={place}
      setPlace={setPlace}
      reload={reload}
    >
      <PlaceNavBridge />
      <PlaceUIProvider>{children}</PlaceUIProvider>
      <PlaceSaveBar />
    </PlaceProvider>
  );
}
