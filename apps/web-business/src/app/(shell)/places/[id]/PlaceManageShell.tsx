"use client";

// The client half of the Place screen (MESITA-1537): it owns the AdminPlace
// state the ported sections read through PlaceContext, and the one-save bar.
//
// Admin's PlaceEditChrome is deliberately NOT ported: it is sticky top-0
// z-30 (the shell's TopNav already occupies that line), it repeats the title
// the layout renders, it links to /manage-single/select (a 404 here), and it
// polls enrichment every 8-60s from every tab. The shell's title + PlaceTabs
// is the chrome.

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { PlaceProvider } from "@/components/place-manage/PlaceContext";
import { PlaceSaveBar } from "@/components/place-manage/PlaceSaveBar";
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
      projectId={placeId}
      place={place}
      setPlace={setPlace}
      reload={reload}
    >
      {children}
      <PlaceSaveBar />
    </PlaceProvider>
  );
}
