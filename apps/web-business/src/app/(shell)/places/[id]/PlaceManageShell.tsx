"use client";

// The client half of the Place screen (MESITA-1537): it owns the AdminPlace
// state the ported sections read through PlaceContext, and the one-save bar.
//
// Admin's PlaceEditChrome is deliberately NOT ported: it repeats operator
// state a restaurant may not see, it links to /manage-single/select (a 404
// here), and it polls enrichment every 8-60s from every tab. PlaceBar is the
// chrome.
//
// `header` is a PROP, not something the caller renders beside us, because the
// bar has to be INSIDE PlaceProvider to reach guardNav — and "inside" as a
// JSX-position convention is enforced by nothing. usePlaceContext throws, so
// a later edit that moved the bar one line up would crash every managed
// place, past tsc, eslint and the tests. Taking it as a prop makes the
// position structural.

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { PlaceProvider } from "@/components/place-manage/PlaceContext";
import { PlaceSaveBar } from "@/components/place-manage/PlaceSaveBar";
import type { AdminPlace } from "@/components/place-manage/actions";

export function PlaceManageShell({
  placeId,
  initialPlace,
  header,
  children,
}: {
  placeId: string;
  initialPlace: AdminPlace;
  header: React.ReactNode;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [place, setPlace] = useState<AdminPlace>(initialPlace);
  const reload = useCallback(() => router.refresh(), [router]);

  return (
    <PlaceProvider
      projectId={placeId}
      place={place}
      setPlace={setPlace}
      reload={reload}
    >
      {header}
      {children}
      <PlaceSaveBar />
    </PlaceProvider>
  );
}
