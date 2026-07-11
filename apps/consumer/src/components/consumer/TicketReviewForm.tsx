"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

const NOTE_MIN = 50;

export type TicketReviewDraft = {
  food: number;
  service: number;
  ambiance: number;
  value: number;
  overall: number;
  comments: string;
};

function StarRatingRow({
  label,
  hint,
  value,
  onChange,
  emphasized = false,
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (n: number) => void;
  emphasized?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border px-3 py-2",
        emphasized
          ? "border-foreground/15 bg-muted/30"
          : "border-border/70 bg-background",
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <p
          className={cn(
            "font-medium",
            emphasized
              ? "text-foreground text-sm"
              : "text-foreground text-[13px]",
          )}
        >
          {label}
        </p>
        <p className="text-muted-foreground shrink-0 text-xs tabular-nums">
          {value}/5
        </p>
      </div>
      {hint ? (
        <p className="text-muted-foreground mt-0.5 text-[11px]">{hint}</p>
      ) : null}
      <div
        className="mt-1.5 flex justify-between gap-1"
        role="group"
        aria-label={label}
      >
        {[1, 2, 3, 4, 5].map((n) => {
          const on = value >= n;
          return (
            <button
              key={n}
              type="button"
              aria-label={`${label}: ${n} star${n === 1 ? "" : "s"}`}
              aria-pressed={value === n}
              onClick={() => onChange(n)}
              className="flex flex-1 items-center justify-center rounded-lg py-0.5 transition active:scale-95"
            >
              <Star
                className={cn(
                  "h-7 w-7",
                  on
                    ? "fill-amber-400 text-amber-400"
                    : "text-muted-foreground/35",
                )}
                strokeWidth={on ? 0 : 1.5}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function TicketReviewForm({
  draft,
  onChange,
  onSubmit,
  busy,
  placeName,
  showIntro = true,
}: {
  draft: TicketReviewDraft;
  onChange: (draft: TicketReviewDraft) => void;
  onSubmit: () => void;
  busy?: boolean;
  placeName?: string | null;
  showIntro?: boolean;
}) {
  const ratingsSet =
    draft.overall > 0 &&
    draft.food > 0 &&
    draft.service > 0 &&
    draft.ambiance > 0 &&
    draft.value > 0;
  const noteLen = draft.comments.trim().length;
  const canSubmit = ratingsSet && noteLen >= NOTE_MIN;
  return (
    <div className="space-y-3">
      {placeName ? (
        <p className="text-foreground text-sm font-medium">{placeName}</p>
      ) : null}
      {showIntro !== false ? (
        <ol className="text-muted-foreground list-decimal space-y-1 pl-4 text-[13px] leading-snug">
          <li>Tap stars on each row — 1 is bad, 5 is great.</li>
          <li>
            Fill in Overall first, then Food, Service, Ambiance, and Value.
          </li>
          <li>Add a note about your visit, then tap Send review.</li>
        </ol>
      ) : null}

      <div className="space-y-2">
        <StarRatingRow
          label="Overall"
          hint="How was the visit in general?"
          value={draft.overall}
          onChange={(overall) => onChange({ ...draft, overall })}
          emphasized
        />
        <StarRatingRow
          label="Food"
          value={draft.food}
          onChange={(food) => onChange({ ...draft, food })}
        />
        <StarRatingRow
          label="Service"
          value={draft.service}
          onChange={(service) => onChange({ ...draft, service })}
        />
        <StarRatingRow
          label="Ambiance"
          value={draft.ambiance}
          onChange={(ambiance) => onChange({ ...draft, ambiance })}
        />
        <StarRatingRow
          label="Value"
          value={draft.value}
          onChange={(value) => onChange({ ...draft, value })}
        />
      </div>

      <label className="block">
        <span className="text-foreground mb-1 flex items-center justify-between text-[13px] font-medium">
          <span>Notes</span>
          <span
            className={cn(
              "text-[11px] font-normal tabular-nums",
              noteLen >= NOTE_MIN
                ? "text-emerald-600"
                : "text-muted-foreground",
            )}
          >
            {noteLen}/{NOTE_MIN}
          </span>
        </span>
        <textarea
          value={draft.comments}
          onChange={(e) => onChange({ ...draft, comments: e.target.value })}
          placeholder="e.g. great tacos, slow drinks…"
          rows={2}
          className="border-border bg-background text-foreground placeholder:text-muted-foreground/70 w-full resize-none rounded-xl border px-3 py-2 text-sm"
        />
      </label>

      {!canSubmit ? (
        <p className="text-muted-foreground text-center text-[12px]">
          {ratingsSet
            ? `Your note needs at least ${NOTE_MIN} characters.`
            : "Tap a rating on every row to continue."}
        </p>
      ) : null}
      <button
        type="button"
        onClick={onSubmit}
        disabled={busy || !canSubmit}
        className="btn-primary"
      >
        {busy ? "Sending…" : "Send review"}
      </button>
    </div>
  );
}
