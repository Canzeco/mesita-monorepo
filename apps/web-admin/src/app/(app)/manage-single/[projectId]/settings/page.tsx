"use client";

import { SettingsSection } from "../../sections/SettingsSection";
import { useUnitPlace } from "../../UnitPlaceContext";

// Settings — the operator/meta cards pulled out of the Place tab
// (MESITA-834): Manual Priority, Ownership, Metadata, Embeddings.
export default function UnitSettingsPage() {
  const { place } = useUnitPlace();

  return (
    <div className="mx-auto max-w-7xl">
      <SettingsSection place={place} />
    </div>
  );
}
