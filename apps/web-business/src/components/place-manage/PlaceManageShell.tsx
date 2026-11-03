"use client";

// The client half of the place surface (MESITA-2086; moved from web-admin to
// the Business app in MESITA-3103): owns the place state the profile editor
// reads through PlaceContext, and the one save bar.
//
// The save bar shows on Profile only. Off Profile the draft still lives in
// the mounted (hidden) form, so leaving and coming back keeps it.

import { useState } from "react";
import { usePathname } from "next/navigation";
import { PlaceProvider } from "@/components/place-manage/PlaceContext";
import { PlaceSaveBar } from "@/components/place-manage/PlaceSaveBar";
import type { AdminPlace, ProfileRead } from "@/components/place-manage/actions";
import { placeTabFromPathname } from "@/lib/routes";

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
  const tab = placeTabFromPathname(usePathname());

  return (
    <PlaceProvider
      placeId={placeId}
      place={place}
      setPlace={setPlace}
      profile={profile}
      setProfile={setProfile}
    >
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      {tab === "profile" ? <PlaceSaveBar /> : null}
    </PlaceProvider>
  );
}
