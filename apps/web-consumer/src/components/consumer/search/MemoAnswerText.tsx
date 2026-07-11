"use client";

// Memo's answer as natural text with the recommended places woven in as
// underlined, tappable links — Ask AI has no place cards / "special entities".
// We linkify by finding each prediction's name inside the prose (case-
// insensitive, longest name first so "Vancouver Wings Tec" wins over the bare
// "Vancouver", non-overlapping, first mention only). Tapping a name opens the
// place: on-Mesita → the detail modal (onInfo); not-yet-on-Mesita → the real
// Add / enrich flow (onAdd). Names Memo didn't spell out verbatim in the prose
// still get a home in a compact trailing line so no suggestion is lost.

import { useMemo } from "react";
import type { Place } from "@/lib/api/places";
import type { PlacePrediction } from "@/lib/api/place-search";
import { cn } from "@/lib/utils";
import type { AddState } from "./PredictionRow";

type Segment =
  | { kind: "text"; value: string }
  | { kind: "place"; value: string; prediction: PlacePrediction };

type Linkified = { segments: Segment[]; unlinked: PlacePrediction[] };

function linkify(text: string, predictions: PlacePrediction[]): Linkified {
  const lower = text.toLowerCase();
  const taken: Array<{ start: number; end: number; prediction: PlacePrediction }> =
    [];
  const unlinked: PlacePrediction[] = [];

  // Longest names first so a fuller name claims the span before a shorter one
  // that's a substring of it.
  const byLength = [...predictions].sort(
    (a, b) => (b.mainText?.length ?? 0) - (a.mainText?.length ?? 0),
  );

  for (const prediction of byLength) {
    const name = prediction.mainText?.trim();
    if (!name) continue;
    const needle = name.toLowerCase();
    let from = 0;
    let placed = false;
    for (;;) {
      const idx = lower.indexOf(needle, from);
      if (idx === -1) break;
      const end = idx + needle.length;
      const overlaps = taken.some((r) => idx < r.end && end > r.start);
      if (!overlaps) {
        taken.push({ start: idx, end, prediction });
        placed = true;
        break;
      }
      from = idx + 1;
    }
    if (!placed) unlinked.push(prediction);
  }

  taken.sort((a, b) => a.start - b.start);

  const segments: Segment[] = [];
  let cursor = 0;
  for (const range of taken) {
    if (range.start > cursor) {
      segments.push({ kind: "text", value: text.slice(cursor, range.start) });
    }
    segments.push({
      kind: "place",
      value: text.slice(range.start, range.end),
      prediction: range.prediction,
    });
    cursor = range.end;
  }
  if (cursor < text.length) {
    segments.push({ kind: "text", value: text.slice(cursor) });
  }

  return { segments, unlinked };
}

export function MemoAnswerText({
  text,
  predictions,
  resolvePlace,
  addStates,
  onInfo,
  onAdd,
}: {
  text: string;
  predictions: PlacePrediction[];
  resolvePlace: (prediction: PlacePrediction) => Place | null;
  addStates: Record<string, AddState>;
  onInfo: (prediction: PlacePrediction) => void;
  onAdd: (prediction: PlacePrediction) => void;
}) {
  const { segments, unlinked } = useMemo(
    () => linkify(text, predictions),
    [text, predictions],
  );

  // On-Mesita → open the detail modal; otherwise kick off the real Add flow so
  // the place gets created + enriched (same mechanics the old cards used).
  const open = (prediction: PlacePrediction) => {
    const onMesita =
      Boolean(prediction.mesitaSlug ?? prediction.mesitaId) ||
      Boolean(resolvePlace(prediction));
    if (onMesita) onInfo(prediction);
    else onAdd(prediction);
  };

  const PlaceLink = ({
    prediction,
    children,
  }: {
    prediction: PlacePrediction;
    children: React.ReactNode;
  }) => {
    const adding = addStates[prediction.placeId] === "adding";
    return (
      <button
        type="button"
        onClick={() => open(prediction)}
        className={cn(
          "decoration-primary/50 hover:decoration-primary text-foreground rounded font-medium underline decoration-1 underline-offset-2 transition active:opacity-70",
          adding && "opacity-60",
        )}
      >
        {children}
      </button>
    );
  };

  return (
    <span className="whitespace-pre-wrap">
      {segments.map((seg, i) =>
        seg.kind === "text" ? (
          <span key={i}>{seg.value}</span>
        ) : (
          <PlaceLink key={i} prediction={seg.prediction}>
            {seg.value}
          </PlaceLink>
        ),
      )}
      {unlinked.length > 0 && (
        <span className="text-muted-foreground mt-1 block text-[13px]">
          También:{" "}
          {unlinked.map((prediction, i) => (
            <span key={prediction.placeId}>
              {i > 0 && ", "}
              <PlaceLink prediction={prediction}>{prediction.mainText}</PlaceLink>
            </span>
          ))}
        </span>
      )}
    </span>
  );
}
