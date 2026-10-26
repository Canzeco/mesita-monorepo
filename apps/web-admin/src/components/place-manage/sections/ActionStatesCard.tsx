"use client";

import { Zap } from "lucide-react";
import type { AdminPlace } from "../actions";
import { SectionCard } from "@/components/admin-ui/manage";
import { StateRow } from "./StateCard";

// Profile's Actions box (MESITA-2786): what a guest can do at this place.
// Read-only. Reservations is the LLM's call at Create and Enrich (never a
// rule on links); an operator's reservation-channel pick overrides it
// (MESITA-1737). Payments and prepayments are not built, so they read No.

export function ActionStatesCard({ place }: { place: AdminPlace }) {
  const rows = [
    {
      key: "reservations",
      label: "Mesita Reservations Enabled",
      on: place.reservations_enabled === true,
      detail: "Inferred by the LLM at Create and Enrich. A reservation channel picked by an operator overrides it.",
    },
    {
      key: "payments",
      label: "Mesita Payments Enabled",
      on: false,
      detail: "Off until Mesita Payments ships.",
    },
    {
      key: "prepayments",
      label: "Mesita Prepayments Enabled",
      on: false,
      detail: "Off until Mesita Prepayments ships.",
    },
  ];
  return (
    <SectionCard icon={<Zap className="h-4 w-4" />} tint="amber" title="Actions" subtitle="What a guest can do here.">
      <div className="mt-5 flex flex-col">
        {rows.map((row) => (
          <StateRow
            key={row.key}
            name={row.label}
            on={row.on}
            chip={row.on ? "Yes" : "No"}
            detail={row.detail}
          />
        ))}
      </div>
    </SectionCard>
  );
}
