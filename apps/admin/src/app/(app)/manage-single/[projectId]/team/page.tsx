"use client";

import { TeamSection } from "../../sections/TeamSection";
import { useUnitPlace } from "../../UnitPlaceContext";

// Owner/editor management — the Place tab's Ownership card links here via
// its "Edit →". Backed by the business-web team EFs (super-admins bypass the
// membership check, which is what authorises the admin operator).
export default function UnitTeamPage() {
  const { place } = useUnitPlace();

  return (
    <div className="mx-auto max-w-6xl">
      <TeamSection place={place} />
    </div>
  );
}
