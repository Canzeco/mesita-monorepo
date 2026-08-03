"use client";

import { Instagram, MessageCircle, Star } from "lucide-react";
import type { PlaceActivity } from "../actions";
import { SectionCard } from "../ui";

// Performance → Stories & comments. The guest-generated content this place
// actually earned (Pato 2026-08-03: "you can see like all the stories and
// comments and shit"):
//
//   stories  — the Instagram-story / Google-review tasks guests completed
//              against a ticket, with their state.
//   comments — the post-visit review text + per-axis ratings.
//
// Read-only — and since v3 (MESITA-849) there is no verdict anywhere: the
// guest completes their tasks before the scan and their own declaration is
// the verification. The rejected/needs-review states below only ever render
// on tickets that predate v3.

const STATE: Record<string, { label: string; chip: string }> = {
  pending: { label: "Awaiting guest", chip: "bg-muted text-muted-foreground" },
  self_verified: {
    label: "Done by guest",
    chip: "bg-emerald-500/10 text-emerald-700",
  },
  submitted: { label: "Needs review", chip: "bg-amber-500/10 text-amber-700" },
  ai_verified: { label: "Approved (AI)", chip: "bg-emerald-500/10 text-emerald-700" },
  staff_verified: { label: "Approved", chip: "bg-emerald-500/10 text-emerald-700" },
  waiter_verified: { label: "Approved", chip: "bg-emerald-500/10 text-emerald-700" },
  ai_rejected: { label: "Rejected (AI)", chip: "bg-rose-500/10 text-rose-700" },
  staff_rejected: { label: "Rejected", chip: "bg-rose-500/10 text-rose-700" },
  not_required: { label: "Not required", chip: "bg-muted text-muted-foreground" },
};

function chipFor(s: string | null) {
  return STATE[s ?? ""] ?? { label: s ?? "—", chip: "bg-muted text-muted-foreground" };
}

function when(iso: string | null): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  return new Date(t).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function Stars({ n }: { n: number | null }) {
  if (n == null) return null;
  const filled = Math.min(5, Math.max(0, Math.round(n)));
  return (
    <span className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={
            "h-3 w-3 " +
            (i < filled ? "fill-amber-400 text-amber-400" : "text-muted-foreground/35")
          }
          strokeWidth={0}
        />
      ))}
    </span>
  );
}

export function StoriesCommentsPanel({ activity }: { activity: PlaceActivity }) {
  const { stories, comments } = activity;

  // One card per submitted screenshot — a ticket can carry both a story and a
  // review, so flatten to the individual artefacts.
  const shots = stories.flatMap((s) => {
    const out: {
      key: string;
      kind: "story" | "review";
      url: string;
      status: string | null;
      guest: string;
      at: string | null;
      reason?: string | null;
    }[] = [];
    if (s.story.screenshotUrl) {
      out.push({
        key: `${s.ticketId}-story`,
        kind: "story",
        url: s.story.screenshotUrl,
        status: s.story.status,
        guest: s.guest,
        at: s.story.submittedAt ?? s.createdAt,
        reason: s.story.rejectReason,
      });
    }
    if (s.review.screenshotUrl) {
      out.push({
        key: `${s.ticketId}-review`,
        kind: "review",
        url: s.review.screenshotUrl,
        status: s.review.status,
        guest: s.guest,
        at: s.review.submittedAt ?? s.createdAt,
      });
    }
    return out;
  });

  return (
    <SectionCard
      icon={<MessageCircle className="h-4 w-4" />}
      tint="rose"
      title="Stories & comments"
      subtitle="What guests posted and wrote after visiting. Verdicts are decided on the check page, not here."
    >
      <div className="mt-5 flex flex-col gap-6">
        <div>
          <p className="text-muted-foreground text-[11px] font-semibold tracking-[0.12em] uppercase">
            Story &amp; review screenshots · {shots.length}
          </p>
          {shots.length === 0 ? (
            <p className="text-muted-foreground mt-2 px-1 text-xs leading-relaxed">
              No screenshots submitted yet — guests upload these from the ticket
              flow when a place runs the story or review rung.
            </p>
          ) : (
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {shots.map((s) => {
                const c = chipFor(s.status);
                return (
                  <figure
                    key={s.key}
                    className="border-border bg-background overflow-hidden rounded-xl border"
                  >
                    {/* External, unoptimizable guest upload. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={s.url}
                      alt={`${s.kind} submitted by ${s.guest}`}
                      loading="lazy"
                      className="bg-muted h-40 w-full object-cover"
                    />
                    <figcaption className="flex flex-col gap-1.5 p-2.5">
                      <span className="flex items-center gap-1.5">
                        {s.kind === "story" ? (
                          <Instagram className="text-muted-foreground h-3 w-3 shrink-0" />
                        ) : (
                          <Star className="text-muted-foreground h-3 w-3 shrink-0" />
                        )}
                        <span className="truncate text-xs font-medium">{s.guest}</span>
                      </span>
                      <span
                        className={
                          "w-fit rounded-full px-2 py-0.5 text-[10px] font-semibold " +
                          c.chip
                        }
                      >
                        {c.label}
                      </span>
                      {s.at && (
                        <span className="text-muted-foreground text-[10px]">
                          {when(s.at)}
                        </span>
                      )}
                      {s.reason && (
                        <span className="text-muted-foreground text-[10px] italic">
                          {s.reason}
                        </span>
                      )}
                    </figcaption>
                  </figure>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <p className="text-muted-foreground text-[11px] font-semibold tracking-[0.12em] uppercase">
            Guest comments · {comments.length}
          </p>
          {comments.length === 0 ? (
            <p className="text-muted-foreground mt-2 px-1 text-xs leading-relaxed">
              No written reviews yet — guests leave these after a ticket closes.
            </p>
          ) : (
            <div className="mt-3 flex flex-col gap-2">
              {comments.map((c) => (
                <div
                  key={c.id}
                  className="border-border bg-background rounded-xl border p-3.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-sm font-semibold">{c.guest}</span>
                      <Stars n={c.overall} />
                    </span>
                    <span className="text-muted-foreground shrink-0 text-[11px]">
                      {when(c.createdAt)}
                    </span>
                  </div>
                  {c.comments && (
                    <p className="text-foreground/85 mt-1.5 text-sm leading-relaxed">
                      “{c.comments}”
                    </p>
                  )}
                  <div className="text-muted-foreground mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
                    {(
                      [
                        ["Food", c.food],
                        ["Service", c.service],
                        ["Ambiance", c.ambiance],
                        ["Value", c.value],
                      ] as const
                    )
                      .filter(([, v]) => v != null)
                      .map(([label, v]) => (
                        <span key={label} className="tabular-nums">
                          {label} {v}
                        </span>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </SectionCard>
  );
}
