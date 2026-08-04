"use client";

import { SettingsSection } from "../../sections/SettingsSection";
import { useUnitPlace } from "../../UnitPlaceContext";

// Settings — what the business itself may set (MESITA-834): Reservations
// routing (MESITA-837), Check PIN, Team. Mesita-internal cards live on Admin.
export default function UnitSettingsPage() {
  const { place, setPlace } = useUnitPlace();

  return (
    <div className="mx-auto max-w-7xl">
      <SettingsSection place={place} onSaved={setPlace} />
    </div>
  );
}
