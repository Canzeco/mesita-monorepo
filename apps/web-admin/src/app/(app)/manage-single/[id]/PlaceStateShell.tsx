"use client";

// Holds the place row for the Single Place views (MESITA-3103: the profile
// editor and its save bar moved to the Business app).

import { useState } from "react";
import { PlaceProvider } from "@/components/place-manage/PlaceContext";
import type { AdminPlace, ProfileRead } from "@/components/place-manage/actions";

export function PlaceStateShell({
  initialPlace,
  initialProfile,
  children,
}: {
  initialPlace: AdminPlace;
  initialProfile: ProfileRead;
  children: React.ReactNode;
}) {
  const [place, setPlace] = useState<AdminPlace>(initialPlace);
  return (
    <PlaceProvider place={place} setPlace={setPlace} profile={initialProfile}>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </PlaceProvider>
  );
}
