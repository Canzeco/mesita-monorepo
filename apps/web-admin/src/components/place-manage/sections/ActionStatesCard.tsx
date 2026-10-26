"use client";

import { useState } from "react";
import { Zap } from "lucide-react";
import type { AdminPlace } from "../actions";
import { updatePlace } from "../actions";
import { usePlaceContext } from "../PlaceContext";
import { SectionCard } from "@/components/admin-ui/manage";
import { Switch } from "@/components/admin-ui/config";

// Profile's Actions box (MESITA-2786, toggles MESITA-2787). Reservations
// saves the moment it flips; the save stores it as the operator's answer so a
// later Enrich cannot reopen or close bookings. Payments and prepayments are
// not built: locked off.

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-border flex items-center justify-between gap-4 border-b py-3 last:border-b-0">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </div>
  );
}

export function ActionStatesCard({ place }: { place: AdminPlace }) {
  const { setPlace } = usePlaceContext();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const on = place.reservations_enabled === true;

  async function toggle() {
    setPending(true);
    setError(null);
    const current = place.reservation_channel;
    const channel = on ? "none" : current && current !== "none" ? current : "phone";
    const r = await updatePlace({ id: place.id, reservations_enabled: !on, reservation_channel: channel });
    setPending(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setPlace(r.data.place);
  }

  return (
    <SectionCard icon={<Zap className="h-4 w-4" />} tint="amber" title="Actions" subtitle="What a guest can do here.">
      <div className="mt-3 flex flex-col">
        <Row label="Mesita Reservations Enabled">
          <Switch on={on} pending={pending} onClick={toggle} label="Mesita Reservations Enabled" />
        </Row>
        <Row label="Mesita Payments Enabled">
          <Switch on={false} pending onClick={() => {}} label="Mesita Payments Enabled" />
        </Row>
        <Row label="Mesita Prepayments Enabled">
          <Switch on={false} pending onClick={() => {}} label="Mesita Prepayments Enabled" />
        </Row>
      </div>
      {error ? <p className="text-destructive mt-2 text-xs">{error}</p> : null}
    </SectionCard>
  );
}
