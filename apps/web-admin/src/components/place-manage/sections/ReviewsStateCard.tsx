"use client";

// Reviews States — the three Found facts (MESITA-2190):
//
//   Google Found · Instagram Found · Facebook Found
//
// Each is yes or no, read from place_profiles. Stars, snippets and follower
// counts stay on the Reviews tab as display. They are not states.

import { Star } from "lucide-react";
import type { AdminPlace } from "../actions";
import { SectionCard } from "@/components/admin-ui/manage";
import { REVIEW_STATE_FACTS, stateBoolChip } from "@/lib/state-vocabulary";
import { StateRow } from "./StateCard";

const DETAIL: Record<(typeof REVIEW_STATE_FACTS)[number]["key"], readonly [string, string]> = {
  google_found: [
    "The Google listing resolved.",
    "The Google listing did not resolve.",
  ],
  instagram_found: [
    "The Instagram account resolved.",
    "The Instagram account did not resolve.",
  ],
  facebook_found: [
    "The Facebook page resolved.",
    "The Facebook page did not resolve.",
  ],
};

export function ReviewsStateCard({ place }: { place: AdminPlace }) {
  return (
    <SectionCard
      icon={<Star className="h-4 w-4" />}
      tint="violet"
      title="Reviews States"
    >
      <div className="mt-5 flex flex-col">
        {REVIEW_STATE_FACTS.map((fact) => {
          const raw = place[fact.key];
          const known = typeof raw === "boolean";
          const on = known ? raw : false;
          const [yes, no] = DETAIL[fact.key];
          return (
            <StateRow
              key={fact.key}
              name={fact.label}
              on={on}
              chip={stateBoolChip(known ? on : "unknown")}
              detail={known ? (on ? yes : no) : "This payload does not carry that fact."}
            />
          );
        })}
      </div>
    </SectionCard>
  );
}
