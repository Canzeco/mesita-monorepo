"use client";

import { SettingsSection } from "../../sections/SettingsSection";
import { useUnitPlace } from "../../UnitPlaceContext";

// Settings — the operator cards pulled out of the Place tab (MESITA-834):
// Manual Priority, Reservations routing (MESITA-837), Team, Ownership,
// Metadata, Embeddings.
export default function UnitSettingsPage() {
  const { place, setPlace } = useUnitPlace();

  return (
    <div className="mx-auto max-w-7xl">
      <SettingsSection place={place} onSaved={setPlace} />
    </div>
  );
}
