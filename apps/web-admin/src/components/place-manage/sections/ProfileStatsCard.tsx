"use client";

// Profile Stats — read-only member counts (MESITA-2735, discovery overhaul uc1b):
//
//   Viewed · Saved
//
// Unique members from place_activity (one row per consumer × place × kind).
// Request counts and Requested do not appear here or in Profile States.

import { BarChart3 } from "lucide-react";
import type { AdminPlace } from "../actions";
import { SectionCard } from "@/components/admin-ui/manage";
import {
  PROFILE_STATS_FACTS,
  profileStatCountChip,
  profileStatFromRow,
} from "@/lib/state-vocabulary";
import { StateRow } from "./StateCard";

const DETAIL: Record<(typeof PROFILE_STATS_FACTS)[number]["key"], string> = {
  viewed:
    "Unique members who opened this place profile (Social viewed event).",
  saved: "Unique members who saved this place (Social liked/saved event).",
};

export function ProfileStatsCard({ place }: { place: AdminPlace }) {
  const stats = place.profile_stats;
  return (
    <SectionCard
      icon={<BarChart3 className="h-4 w-4" />}
      tint="sky"
      title="Profile Stats"
    >
      <div className="mt-5 flex flex-col">
        {PROFILE_STATS_FACTS.map((fact) => {
          const raw = stats?.[fact.key];
          const count = profileStatFromRow(raw);
          const known = count !== "unknown";
          const n = known ? count : 0;
          return (
            <StateRow
              key={fact.key}
              name={fact.label}
              on={known && n > 0}
              chip={profileStatCountChip(raw)}
              detail={
                known
                  ? DETAIL[fact.key]
                  : "This payload does not carry Profile Stats."
              }
            />
          );
        })}
      </div>
    </SectionCard>
  );
}
