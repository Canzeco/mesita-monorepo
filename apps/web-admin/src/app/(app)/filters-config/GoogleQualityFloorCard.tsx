"use client";

// Google Places quality floor — a PROPOSAL, not a live knob.
//
// The floor belongs to the SOURCE, not to a mode: one rule over everything
// the three Google searches return. That is Search and Map — the lanes that
// query Google. It is NOT every mode: Catalog, Swipe and the Pay / Home /
// bbox branch never call Google, and `discovery_config.filters` is their
// floor. Today's live equivalent is General › Minimum Google reviews on the
// Modes tab (`discovery_config.general.minReviews`, the post-Google wipe) —
// that box still wins, and this one persists nothing until it replaces it.
//
// Local state only. The fields move so the shape is legible; there is no
// Save, because a Save that writes nothing is worse than no Save at all.

import { useState } from "react";
import { MessageSquare, ShieldCheck, Star } from "lucide-react";
import { KnobState, NumberField, SectionCard } from "@/components/admin-ui/config";
import { GENERAL_MIN_REVIEWS_MAX } from "./catalog";

const MIN_RATING_MAX = 5;

export function GoogleQualityFloorCard() {
  const [minReviews, setMinReviews] = useState(0);
  const [minRating, setMinRating] = useState(0);

  return (
    <div id="s-google-quality" className="scroll-mt-16">
      <SectionCard
        icon={<ShieldCheck className="text-primary h-4 w-4" />}
        title="Google Places quality floor"
        subtitle="One floor over everything the three Google searches return. Search and Map share it — the lanes that actually query Google. Catalog, Swipe and the Home rails draw from the listed Mesita pool and answer to operator filters instead."
        state={
          <KnobState
            kind="not-wired"
            reason="proposal · General › Minimum Google reviews is today's live floor"
          />
        }
      >
        <p className="text-muted-foreground mt-5 type-meta">
          A filter excludes; a signal demotes. These cut the list Google just
          returned, before any mode ranks it — nothing downstream can put a
          wiped place back.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <NumberField
            icon={<MessageSquare className="mt-0.5 h-4 w-4 shrink-0" />}
            label="Minimum Google reviews"
            value={minReviews}
            min={0}
            max={GENERAL_MIN_REVIEWS_MAX}
            disabled={false}
            onChange={setMinReviews}
          />
          <NumberField
            icon={<Star className="mt-0.5 h-4 w-4 shrink-0" />}
            label="Minimum Google rating"
            value={minRating}
            min={0}
            max={MIN_RATING_MAX}
            decimals
            disabled={false}
            onChange={setMinRating}
          />
        </div>

        <p className="text-muted-foreground mt-4 type-meta">
          Review count is the honest axis: a 5.0 from two people says less
          than a 4.1 from nine hundred. Rating is here for the floor nobody
          argues with, not to do the work — leave it at 0 and let the count
          carry it.
        </p>
        <p className="text-muted-foreground mt-2 type-meta">
          {minReviews > 0
            ? `Under ${minReviews} reviews is wiped, and so is a place with no review count — a floor asks a place to prove it clears the bar.`
            : "0 is off. Any number asks a place to prove the count; one with no review count is wiped too."}
        </p>
      </SectionCard>
    </div>
  );
}
