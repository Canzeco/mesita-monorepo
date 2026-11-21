"use client";

// Read-only Scores box (MESITA-4515). The numbers come from
// business-web-get-place, which uses the same Popular Organic formula as
// the place screen. This card does not fetch Foursquare.

import { Gauge } from "lucide-react";
import { SectionCard } from "@/components/ui/manage";
import type { AdminPlace } from "../actions";

type ScoreRow = {
  label: string;
  value: string;
  detail: string;
  href?: string | null;
};

type PlaceScoreCard = {
  context: string;
  headline: string;
  rows: ScoreRow[];
};

function readScores(raw: unknown): PlaceScoreCard | null {
  if (!raw || typeof raw !== "object") return null;
  const card = raw as PlaceScoreCard;
  if (typeof card.headline !== "string" || !Array.isArray(card.rows)) return null;
  return card;
}

export function ScoresCard({ place }: { place: AdminPlace }) {
  const scores = readScores(place.scores);
  if (!scores) return null;
  return (
    <SectionCard
      icon={<Gauge size={20} />}
      title="Scores"
      subtitle={scores.context}
    >
      <p className="text-foreground mt-4 text-sm">{scores.headline}</p>
      <div className="mt-2">
        {scores.rows.map((row) => (
          <div key={row.label} className="border-border flex flex-col gap-0.5 border-b py-3 last:border-0">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-medium">{row.label}</span>
              <span className="text-sm tabular-nums">{row.value}</span>
            </div>
            <p className="text-muted-foreground text-sm">
              {row.detail}
              {row.href ? (
                <>
                  {" · "}
                  <a
                    href={row.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-foreground font-medium underline-offset-2 hover:underline"
                  >
                    View on Foursquare ↗
                  </a>
                </>
              ) : null}
            </p>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
