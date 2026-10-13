"use client";

// The client half of the place surface in admin (MESITA-2086): owns the
// AdminPlace state the shared sections read through PlaceContext, and the one
// save bar. Same shape as the business console's PlaceManageShell (deleted
// with web-business, MESITA-2089) minus `PlaceNavBridge` — that bridge
// published the unsaved-edits guard to the business rail, and admin's rail is
// not a place rail.

import { useState } from "react";
import { PlaceProvider } from "@/components/place-manage/PlaceContext";
import { PlaceSaveBar } from "@/components/place-manage/PlaceSaveBar";
import type { AdminPlace, ProfileRead } from "@/components/place-manage/actions";

export function PlaceManageShell({
  placeId,
  initialPlace,
  initialProfile,
  children,
}: {
  placeId: string;
  initialPlace: AdminPlace;
  initialProfile: ProfileRead;
  children: React.ReactNode;
}) {
  const [place, setPlace] = useState<AdminPlace>(initialPlace);
  const [profile, setProfile] = useState<ProfileRead>(initialProfile);

  return (
    <PlaceProvider
      placeId={placeId}
      place={place}
      setPlace={setPlace}
      profile={profile}
      setProfile={setProfile}
    >
      {children}
      <PlaceSaveBar />
    </PlaceProvider>
  );
}
