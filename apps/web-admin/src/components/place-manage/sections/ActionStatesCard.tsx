"use client";

import { Zap } from "lucide-react";
import type { AdminPlace } from "../actions";
import { SectionCard } from "@/components/admin-ui/manage";
import { StateRow } from "./StateCard";

const ROWS = [
  {
    key: "reservations_enabled" as const,
    label: "Accepts reservations",
    detail: "Guest Reserve CTA and reservation flow. Channel choice overrides the create guess.",
  },
  {
    key: "prepay_enabled" as const,
    label: "Accepts prepay",
    detail: "Pay-at-table prepay (default off until product ships).",
  },
  {
    key: "payments_enabled" as const,
    label: "Accepts payments",
    detail: "Mesita Pay capability (default off).",
  },
];

export function ActionStatesCard({ place }: { place: AdminPlace }) {
  return (
    <SectionCard icon={<Zap className="h-4 w-4" />} tint="amber" title="Action States">
      <div className="mt-5 flex flex-col">
        {ROWS.map((row) => (
          <StateRow
            key={row.key}
            name={row.label}
            on={place[row.key] === true}
            chip={place[row.key] === true ? "Yes" : "No"}
            detail={row.detail}
          />
        ))}
      </div>
    </SectionCard>
  );
}
