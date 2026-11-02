"use client";

// The place one Single Place screen is showing, shared by its views
// (Reviews · Preview · Admin · Premier). The profile EDITOR left admin for
// the Business app in MESITA-3103 (one editor; the heading's "Edit profile"
// opens it), so this holds no draft, no save bar and no dirty state: only the
// row, which the Admin and Reviews cards update after their own writes.

import { createContext, useContext, useMemo, type Dispatch, type ReactNode, type SetStateAction } from "react";
import type { AdminPlace, ProfileRead } from "./actions";

type PlaceContextValue = {
  place: AdminPlace;
  setPlace: Dispatch<SetStateAction<AdminPlace>>;
  profile: ProfileRead;
  /** Always false: admin no longer edits the profile. */
  isDirty: false;
};

const PlaceContext = createContext<PlaceContextValue | null>(null);

export function PlaceProvider({
  place,
  setPlace,
  profile,
  children,
}: {
  place: AdminPlace;
  setPlace: Dispatch<SetStateAction<AdminPlace>>;
  profile: ProfileRead;
  children: ReactNode;
}) {
  const value = useMemo<PlaceContextValue>(
    () => ({ place, setPlace, profile, isDirty: false }),
    [place, setPlace, profile],
  );
  return <PlaceContext.Provider value={value}>{children}</PlaceContext.Provider>;
}

export function usePlaceContext(): PlaceContextValue {
  const ctx = useContext(PlaceContext);
  if (!ctx) throw new Error("usePlaceContext must be used inside PlaceProvider");
  return ctx;
}
