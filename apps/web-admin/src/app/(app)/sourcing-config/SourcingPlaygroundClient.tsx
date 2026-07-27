"use client";

import { useState } from "react";
import { CheckCircle2, Filter, Star, Users, XCircle } from "lucide-react";
import { ErrorNote } from "@/components/ErrorNote";
import { SectionCard } from "../enricher-config/atlas-ui";
import {
  CHANNELS,
  FAMILIES,
  type FamilyKey,
  type SourcingConfig,
} from "./catalog";

// Sourcing Playground — a read-only eligibility tester. Enter a candidate place
// (family + Google rating + review count) and see which of the 7 sourcing
// channels would admit it, and why the rest reject it. Pure client compute
// against the saved policy — nothing here writes config or hits an EF.

const inputCls =
  "border-border bg-card focus:border-foreground h-9 w-full rounded-lg border px-3 text-sm outline-none";

function Labeled({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="border-border bg-background flex flex-col gap-2 rounded-xl border p-4">
      <span className="text-muted-foreground flex items-center gap-2 text-xs font-medium">
        {icon}
        {label}
      </span>
      {children}
    </label>
  );
}

export function SourcingPlaygroundClient({
  config,
  loadError,
}: {
  config: SourcingConfig;
  loadError: string | null;
}) {
  const [family, setFamily] = useState<FamilyKey>("restaurants");
  const [rating, setRating] = useState(4.2);
  const [reviews, setReviews] = useState(120);

  const rows = CHANNELS.map((ch) => {
    const p = config[ch.key];
    const checks = {
      enabled: p.enabled,
      family: p.families.includes(family),
      rating: rating >= p.minRating,
      reviews: reviews >= p.minReviews,
    };
    const pass =
      checks.enabled && checks.family && checks.rating && checks.reviews;
    const reasons: string[] = [];
    if (!checks.enabled) reasons.push("channel off");
    if (!checks.family) reasons.push("family not eligible");
    if (!checks.rating) reasons.push(`rating < ${p.minRating}★`);
    if (!checks.reviews) reasons.push(`reviews < ${p.minReviews}`);
    return { ch, p, pass, reasons };
  });

  const admitted = rows.filter((r) => r.pass).length;
  const familyMeta = FAMILIES.find((f) => f.key === family);

  return (
    <div className="space-y-6">
      {loadError && <ErrorNote message={loadError} />}

      <SectionCard
        icon={<Filter className="text-secondary h-4 w-4" />}
        title="The candidate place"
        subtitle="A Google place considered for onboarding. Eligibility is checked against the saved policy — family, rating floor, and review floor — for every channel."
      >
        <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
          <Labeled
            icon={<span aria-hidden>{familyMeta?.emoji ?? "🏷️"}</span>}
            label="Family"
          >
            <select
              className={inputCls}
              value={family}
              onChange={(e) => setFamily(e.target.value as FamilyKey)}
            >
              {FAMILIES.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label}
                </option>
              ))}
            </select>
          </Labeled>
          <Labeled
            icon={<Star className="h-3.5 w-3.5" />}
            label="Google rating (0–5)"
          >
            <input
              type="number"
              min={0}
              max={5}
              step={0.1}
              className={inputCls + " tabular-nums"}
              value={rating}
              onChange={(e) =>
                setRating(Math.max(0, Math.min(5, Number(e.target.value) || 0)))
              }
            />
          </Labeled>
          <Labeled
            icon={<Users className="h-3.5 w-3.5" />}
            label="Review count"
          >
            <input
              type="number"
              min={0}
              className={inputCls + " tabular-nums"}
              value={reviews}
              onChange={(e) =>
                setReviews(Math.max(0, Math.round(Number(e.target.value) || 0)))
              }
            />
          </Labeled>
        </div>
        {familyMeta && (
          <p className="text-muted-foreground/80 mt-3 text-xs">
            {familyMeta.blurb}
          </p>
        )}
        <p className="text-muted-foreground/70 mt-2 text-[11px]">
          A place can belong to more than one family (a gastropub is both a
          restaurant and a bar); the live gate admits it if{" "}
          <span className="font-medium">any</span> of its families is eligible, so
          pick the family you’re testing.
        </p>
      </SectionCard>

      <SectionCard
        icon={<Filter className="text-secondary h-4 w-4" />}
        title="Verdict per channel"
        subtitle={`Admitted by ${admitted} of ${CHANNELS.length} channels. A channel admits the place only if it is on, the family is eligible, and both Google floors clear.`}
      >
        <ul className="mt-4 space-y-1.5">
          {rows.map(({ ch, p, pass, reasons }) => (
            <li
              key={ch.key}
              className="border-border bg-card flex items-start gap-3 rounded-xl border p-3"
            >
              <span className="mt-0.5 shrink-0">
                {pass ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ) : (
                  <XCircle className="text-muted-foreground/40 h-4 w-4" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                  <span>{ch.label}</span>
                  {ch.live && (
                    <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700">
                      live
                    </span>
                  )}
                  {pass ? (
                    <span className="text-xs font-medium text-emerald-600">
                      admitted
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-xs font-normal">
                      rejected — {reasons.join(", ")}
                    </span>
                  )}
                </p>
                <p className="text-muted-foreground/80 mt-0.5 text-[11px]">
                  {p.enabled
                    ? `floors: ${p.minRating}★ · ${p.minReviews} reviews`
                    : "channel disabled"}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </SectionCard>
    </div>
  );
}
