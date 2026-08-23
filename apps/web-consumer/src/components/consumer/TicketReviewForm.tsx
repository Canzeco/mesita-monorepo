"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { TEXTAREA_CLASS } from "@/lib/ui-classes";

const NOTE_MIN = 50;

export type TicketReviewDraft = {
  food: number;
  service: number;
  ambience: number;
  value: number;
  overall: number;
  comments: string;
};

function StarGroup({
  label,
  value,
  onChange,
  size,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  size: "hero" | "compact";
}) {
  const starClass = size === "hero" ? "h-8 w-8" : "h-6 w-6";
  return (
    <div
      className={cn(
        "flex",
        size === "hero" ? "w-full justify-between gap-1" : "shrink-0 gap-0.5",
      )}
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
            className="grid place-items-center rounded-md p-0.5 transition active:scale-95"
          >
            <Star
              className={cn(
                starClass,
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
  );
}

export function TicketReviewForm({
  draft,
  onChange,
  onSubmit,
  busy,
  placeName,
  error,
}: {
  draft: TicketReviewDraft;
  onChange: (draft: TicketReviewDraft) => void;
  onSubmit: () => void;
  busy?: boolean;
  placeName?: string | null;
  /** Inline destructive line above Send (MESITA-908). */
  error?: string | null;
}) {
  const ratingsSet =
    draft.overall > 0 &&
    draft.food > 0 &&
    draft.service > 0 &&
    draft.ambience > 0 &&
    draft.value > 0;
  const noteLen = draft.comments.trim().length;
  const canSubmit = ratingsSet && noteLen >= NOTE_MIN;

  const dims: {
    key: keyof Pick<
      TicketReviewDraft,
      "food" | "service" | "ambience" | "value"
    >;
    label: string;
  }[] = [
    { key: "food", label: "Food" },
    { key: "service", label: "Service" },
    { key: "ambience", label: "Ambience" },
    { key: "value", label: "Value" },
  ];

  return (
    <div className="space-y-1">
      {placeName ? (
        <div className="mb-2">
          <p className="text-foreground text-sm font-extrabold tracking-tight">
            Rate {placeName}
          </p>
          <p className="text-muted-foreground mt-0.5 text-xs">
            On Mesita · feeds its rating
          </p>
        </div>
      ) : null}

      {/* Overall hero — no bordered box, no 0/5 shout (MESITA-908). */}
      <div className="border-border/60 flex flex-col gap-1.5 border-b py-3">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-foreground text-sm font-extrabold">Overall</p>
          {draft.overall > 0 ? (
            <p className="text-muted-foreground type-label tabular-nums">
              {draft.overall}
            </p>
          ) : null}
        </div>
        <StarGroup
          label="Overall"
          value={draft.overall}
          onChange={(overall) => onChange({ ...draft, overall })}
          size="hero"
        />
      </div>

      {dims.map(({ key, label }) => (
        <div
          key={key}
          className="border-border/60 flex items-center justify-between gap-3 border-b py-2.5 last:border-b-0"
        >
          <div className="flex min-w-0 items-baseline gap-2">
            <p className="text-foreground type-body font-semibold">{label}</p>
            {draft[key] > 0 ? (
              <p className="text-muted-foreground type-label tabular-nums">
                {draft[key]}
              </p>
            ) : null}
          </div>
          <StarGroup
            label={label}
            value={draft[key]}
            onChange={(n) => onChange({ ...draft, [key]: n })}
            size="compact"
          />
        </div>
      ))}

      <label className="mt-2 block">
        <span className="text-foreground mb-1 flex items-center justify-between text-xs font-semibold">
          <span>Notes</span>
          <span
            className={cn(
              "type-label font-normal tabular-nums",
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
          className={cn(
            TEXTAREA_CLASS,
            "bg-background text-foreground placeholder:text-muted-foreground/70",
          )}
        />
      </label>

      {error ? (
        <p className="bg-destructive/10 text-destructive rounded-lg px-3 py-2 text-xs">
          {error}
        </p>
      ) : null}

      {!canSubmit ? (
        <p className="text-muted-foreground text-xs">
          {ratingsSet
            ? `Your note needs at least ${NOTE_MIN} characters.`
            : "Rate every row to continue."}
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
