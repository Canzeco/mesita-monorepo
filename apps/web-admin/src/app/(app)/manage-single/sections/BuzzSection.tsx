"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Braces, Megaphone } from "lucide-react";
import { visibilityScore } from "@/lib/business/plans";
import type { AdminPlace } from "../actions";
import { GroupLabel, SectionCard, TINT_CHIP } from "../ui";

// ════════════════════════════════════════════════════════════════════════
// Buzz — the place's score in the recommendation engines (Swipe · Map ·
// Memo). Admin-only: the whole console sits behind the super-admin gate.
//
// DRAFT MODEL v3, frontend only. A great visit = a place worth going to ×
// a moment that fits ÷ a distance you'll actually cross:
//
//   score(d) = worth × fit ÷ decay(d)                 decay(d) = 1 + d/d₀
//
//   WORTH — what the place brings (cached, recomputed on Enricher writes):
//     promotional visibility  0–10  bought — the live Promos score.
//     earned reputation       0–10  proven — Google stars × review volume
//                                   + social proof.
//     magnetism               0–10  desired — would it stop a thumb mid-
//                                   swipe? AI-judged from photos, vibe and
//                                   IG presence (draft heuristic here).
//     momentum             ×0.8–1.2 trending — review/follower velocity
//                                   between snapshots (needs history).
//     worth = (PV + reputation + magnetism) / 3 × momentum
//
//   FIT — what this exact moment wants (per query, multiplied):
//     match      0–1  ALWAYS semantic (RAG/LLM), never binary tags. Memo's
//                     query is the question; Swipe/Map's is the consumer's
//                     taste embedding. Zero relevance zeroes the score.
//     right-now  0–1  timing — open now + daypart, from the place's own
//                     hours in its own timezone (computed live below).
//     novelty    0–1  per consumer — seen/rejected decays, never-shown gets
//                     an exploration floor (not simulable per place; see
//                     Buzz Config).
// ════════════════════════════════════════════════════════════════════════

const SCORE_MAX = 10;
const BASE_D0 = 1.5; // km at which the score halves for the headline number

/** Earned reputation, 1–10: stars ≤6 pts, review volume ≤3 (log), social ≤1. */
function reputationScore(place: AdminPlace): number {
  const stars = place.google_stars_overall ?? 0;
  const reviews = place.google_review_count ?? 0;
  const followers = place.instagram_followers_count ?? 0;

  const starPts = (Math.max(0, Math.min(5, stars)) / 5) * 6;
  const volumePts = Math.min(3, (Math.log10(reviews + 1) / Math.log10(5000)) * 3);
  const socialPts = Math.min(1, Math.log10(followers + 1) / 5);

  return Math.max(1, Math.min(10, starPts + volumePts + socialPts));
}

/**
 * Magnetism, 1–10 — desire on sight. In production an LLM/vision judge
 * scores the photo set + description vibe against a rubric; this draft
 * heuristic stands in: photos ≤4, IG pull ≤4, story (description+tags) ≤2.
 */
function magnetismScore(place: AdminPlace): number {
  const photos = place.photos?.length ?? 0;
  const followers = place.instagram_followers_count ?? 0;

  const photoPts = Math.min(4, photos * 0.5);
  const pullPts = Math.min(4, (Math.log10(followers + 1) / 5) * 4);
  const storyPts =
    (place.description ? 1 : 0) + ((place.tags?.length ?? 0) >= 5 ? 1 : 0);

  return Math.max(1, Math.min(10, photoPts + pullPts + storyPts));
}

type RightNow = { factor: number; label: string };

const DAY_ORDER = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

/**
 * Right-now fit from the place's own hours in its own timezone: open ×1.0,
 * closed ×0.15 (engines demote, not hide), unknown hours ×0.7.
 */
function rightNowFit(place: AdminPlace): RightNow {
  const hours = place.hours;
  if (!hours || Object.keys(hours).length === 0) {
    return { factor: 0.7, label: "no hours yet" };
  }

  let weekday: string;
  let minutes: number;
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: place.timezone || "America/Monterrey",
      weekday: "long",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date());
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    weekday = get("weekday").toLowerCase();
    minutes = Number(get("hour")) * 60 + Number(get("minute"));
  } catch {
    return { factor: 0.7, label: "unknown timezone" };
  }

  const toMin = (s: string) => {
    const [h, m] = s.split(":").map(Number);
    return (h ?? 0) * 60 + (m ?? 0);
  };
  // A range with close ≤ open runs past midnight (20:00–02:00): today owns
  // the evening side, yesterday's entry owns the small hours.
  const openToday = (hours[weekday] ?? []).some((r) => {
    const o = toMin(r.open);
    const c = toMin(r.close);
    return c > o ? minutes >= o && minutes < c : minutes >= o;
  });
  const dayIdx = DAY_ORDER.indexOf(weekday as (typeof DAY_ORDER)[number]);
  const yesterday = DAY_ORDER[(dayIdx + 6) % 7];
  const spillFromYesterday = (hours[yesterday] ?? []).some((r) => {
    const o = toMin(r.open);
    const c = toMin(r.close);
    return c <= o && minutes < c;
  });

  return openToday || spillFromYesterday
    ? { factor: 1, label: "open now" }
    : { factor: 0.15, label: "closed now" };
}

/** Per-engine distance sensitivity — d₀ in km at which the score halves. */
const ENGINES = [
  { id: "swipe", label: "Swipe", d0: 1.5 },
  { id: "map", label: "Map", d0: 3 },
  { id: "memo", label: "Memo", d0: 5 },
] as const;

function decay(km: number, d0: number): number {
  return 1 + km / d0;
}

/** Deterministic pseudo-vector from the place id — stand-in until real embeddings exist. */
function mockVector(seed: string, dims: number): number[] {
  const out: number[] = [];
  let h = 2166136261;
  for (let i = 0; i < dims; i++) {
    const c = seed.charCodeAt(i % seed.length) + i;
    h = Math.imul(h ^ c, 16777619);
    out.push(((h >>> 8) % 1000) / 1000);
  }
  return out;
}

function fmt(n: number, digits = 1): string {
  return n.toFixed(digits);
}

export function BuzzSection({ place }: { place: AdminPlace }) {
  const [km, setKm] = useState(1);
  // Simulated semantic match (0–1) — in production RAG computes this per
  // query (Memo's question, or the consumer's taste embedding on Swipe/Map).
  const [match, setMatch] = useState(1);

  const pv = visibilityScore(place);
  const reputation = reputationScore(place);
  const magnetism = magnetismScore(place);
  const momentum = 1; // needs snapshot history — ships with the backend
  const rightNow = rightNowFit(place);

  const worth = ((pv + reputation + magnetism) / 3) * momentum;
  const fit = match * rightNow.factor;
  const scoreAt = (d: number, d0: number = BASE_D0) =>
    (worth * fit) / decay(d, d0);
  const score = scoreAt(km);

  const vector = useMemo(() => mockVector(place.id, 48), [place.id]);

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      <div
        role="status"
        className="border-amber-200/80 bg-amber-50 text-amber-950 flex items-start gap-3 rounded-2xl border px-4 py-3.5 text-sm leading-relaxed"
      >
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
        <div className="min-w-0">
          <p className="font-semibold">Draft simulator — does not affect Swipe, Map, or Memo.</p>
          <p className="mt-0.5 text-xs text-amber-900/80">
            Scores below are frontend heuristics for operators. Global knobs live in{" "}
            <Link href="/buzz-config" className="font-semibold underline-offset-2 hover:underline">
              Buzz Config
            </Link>
            .
          </p>
        </div>
      </div>

      {/* ── Buzz — score, sliders, params, engines ──────────────────── */}
      <SectionCard
        icon={<Megaphone className="h-4.5 w-4.5" />}
        tint="pink"
        title="Buzz"
        subtitle="Score in the recommendation engines — Swipe, the Map and Memo. Admins only."
        action={<Pill>Draft model</Pill>}
      >
        <div className="mt-5 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-end gap-3">
              <p className="font-display text-5xl font-semibold tracking-tight">
                {fmt(score)}
              </p>
              <p className="text-muted-foreground pb-1.5 text-sm">/ {SCORE_MAX}</p>
            </div>
            <Meter value={score / SCORE_MAX} className="mt-3 w-56" />
          </div>

          <div className="flex w-full max-w-sm flex-col gap-3">
            <div>
              <div className="flex items-baseline justify-between">
                <GroupLabel>Semantic match</GroupLabel>
                <span className="text-sm font-semibold">
                  {Math.round(match * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={match}
                onChange={(e) => setMatch(Number(e.target.value))}
                className="accent-primary mt-2 w-full"
                aria-label="Semantic match percentage"
              />
            </div>
            <div>
              <div className="flex items-baseline justify-between">
                <GroupLabel>Consumer distance</GroupLabel>
                <span className="text-sm font-semibold">{fmt(km)} km</span>
              </div>
              <input
                type="range"
                min={0}
                max={8}
                step={0.1}
                value={km}
                onChange={(e) => setKm(Number(e.target.value))}
                className="accent-primary mt-2 w-full"
                aria-label="Consumer distance in km"
              />
            </div>
          </div>
        </div>

        {/* Plain-language equation — the hero number, shown being built from
            its three drivers so an operator reads it without decoding mono. */}
        <div className="mt-6 flex items-stretch gap-1.5 sm:gap-2">
          <EqTerm label="Worth" sub="how good it is" value={fmt(worth)} />
          <EqOp>×</EqOp>
          <EqTerm label="Fit" sub="fits the moment" value={fmt(fit, 2)} />
          <EqOp>÷</EqOp>
          <EqTerm
            label="Distance"
            sub={`${fmt(km)} km away`}
            value={`${fmt(decay(km, BASE_D0), 2)}×`}
          />
          <EqOp>=</EqOp>
          <EqTerm
            label="Buzz"
            sub="what wins the spot"
            value={fmt(score)}
            highlight
          />
        </div>

        <div className="mt-6">
          <div className="flex items-baseline justify-between gap-3">
            <GroupLabel>Worth · the place</GroupLabel>
            <p className="text-muted-foreground font-mono text-[11px]">
              (PV + reputation + magnetism) / 3 × momentum = {fmt(worth)}
            </p>
          </div>
          <p className="text-muted-foreground mt-1 text-[11px] leading-snug">
            How good the place is on its own — before the moment or the
            distance. Higher is better.
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
            <Tile
              label="Promotional Visibility"
              value={`${fmt(pv, 0)}/10`}
              hint="bought · Promos"
              kind="live"
            />
            <Tile
              label="Earned Reputation"
              value={`${fmt(reputation)}/10`}
              hint="proven · Google"
              kind="live"
            />
            <Tile
              label="Magnetism"
              value={`${fmt(magnetism)}/10`}
              hint="desired · AI-judged"
              kind="heuristic"
            />
            <Tile
              label="Momentum"
              value={`×${fmt(momentum, 2)}`}
              hint="trending · needs history"
              kind="mock"
            />
          </div>
        </div>

        <div className="mt-5">
          <div className="flex items-baseline justify-between gap-3">
            <GroupLabel>Fit · the moment</GroupLabel>
            <p className="text-muted-foreground font-mono text-[11px]">
              match × right-now = {fmt(fit, 2)}
            </p>
          </div>
          <p className="text-muted-foreground mt-1 text-[11px] leading-snug">
            How well the place fits this guest right now — the query it matches
            and whether it&apos;s open. Zero on either kills the score.
          </p>
          <div className="mt-2 grid grid-cols-3 gap-2 sm:gap-3">
            <Tile
              label="Match"
              value={`×${fmt(match, 2)}`}
              hint="RAG · per query"
              kind="mock"
            />
            <Tile
              label="Right-now"
              value={`×${fmt(rightNow.factor, 2)}`}
              hint={rightNow.label}
              kind="live"
            />
            <Tile
              label="Decay"
              value={`÷${fmt(decay(km, BASE_D0), 2)}`}
              hint={`at ${fmt(km)} km`}
              kind="mock"
            />
          </div>
        </div>

        <div className="mt-6">
          <GroupLabel>Engines</GroupLabel>
          <div className="mt-3 flex flex-col gap-3">
            {ENGINES.map((e) => {
              const s = scoreAt(km, e.d0);
              return (
                <div key={e.id} className="flex items-center gap-3">
                  <p className="w-14 shrink-0 text-sm font-semibold">{e.label}</p>
                  <Meter value={s / SCORE_MAX} className="flex-1" />
                  <p className="text-muted-foreground w-10 shrink-0 text-right text-xs">
                    {fmt(s)}
                  </p>
                </div>
              );
            })}
          </div>
          <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
            Same score, three appetites for distance — Swipe is the most local,
            Memo cares the least. Novelty (per consumer) is the one factor a
            place page can&apos;t simulate.
          </p>
        </div>
      </SectionCard>

      {/* ── Semantic — meaning retrieves, buzz ranks ────────────────── */}
      <SectionCard
        icon={<Braces className="h-4.5 w-4.5" />}
        tint="indigo"
        title="Semantic"
        subtitle="Match is never binary tags — the place is queried by meaning: its profile embedded as a vector, judged by an LLM. Tags only enrich the text."
        action={<Pill>Mock — no vectors yet</Pill>}
      >
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <div>
            {place.description ? (
              <p className="bg-muted/60 border-border/60 rounded-xl border px-4 py-3 text-sm leading-relaxed">
                {place.description}
              </p>
            ) : (
              <p className="text-muted-foreground bg-muted/60 border-border/60 rounded-xl border px-4 py-3 text-sm italic">
                No description yet — the Enricher writes this; until then there
                is nothing to embed.
              </p>
            )}
            {(place.tags?.length ?? 0) > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {(place.tags ?? []).slice(0, 12).map((t) => (
                  <span
                    key={t}
                    className={
                      "rounded-full px-2.5 py-1 text-[11px] font-medium " +
                      TINT_CHIP.indigo
                    }
                  >
                    {t.replace(/_/g, " ")}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="bg-muted/60 border-border/60 flex h-16 items-end gap-px overflow-hidden rounded-xl border px-3 pt-2">
              {vector.map((v, i) => (
                <span
                  key={i}
                  className="w-full rounded-t-sm bg-indigo-500/50"
                  style={{ height: `${8 + v * 84}%` }}
                />
              ))}
            </div>
            <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
              48 of 1,536 dims, mocked from the place id — the real vector
              comes from embedding the text on the left.
            </p>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

// ── Local bits ─────────────────────────────────────────────────────────

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="bg-muted text-muted-foreground rounded-full px-3 py-1.5 text-[11px] font-semibold">
      {children}
    </span>
  );
}

// One term in the plain-language Buzz equation — value big, human sublabel.
function EqTerm({
  label,
  sub,
  value,
  highlight,
}: {
  label: string;
  sub: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={
        "flex min-w-0 flex-1 flex-col items-center justify-center rounded-xl border px-1.5 py-2.5 text-center " +
        (highlight
          ? "border-primary/40 bg-primary/[0.06]"
          : "border-border/60 bg-muted/40")
      }
    >
      <p className="text-muted-foreground text-[9px] font-bold tracking-[0.12em] uppercase">
        {label}
      </p>
      <p
        className={
          "font-display mt-0.5 text-lg leading-none font-semibold tracking-tight tabular-nums " +
          (highlight ? "text-primary" : "")
        }
      >
        {value}
      </p>
      <p className="text-muted-foreground mt-1 text-[10px] leading-tight">
        {sub}
      </p>
    </div>
  );
}

// Operator glyph between equation terms.
function EqOp({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="text-muted-foreground shrink-0 self-center text-base font-semibold"
      aria-hidden
    >
      {children}
    </span>
  );
}

function Meter({ value, className = "" }: { value: number; className?: string }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div className={"bg-muted h-2 overflow-hidden rounded-full " + className}>
      <div
        className="from-primary h-full rounded-full bg-gradient-to-r to-pink-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function Tile({
  label,
  value,
  hint,
  kind,
}: {
  label: string;
  value: string;
  hint: string;
  kind: "live" | "heuristic" | "mock";
}) {
  const kindLabel =
    kind === "live" ? "live data" : kind === "heuristic" ? "heuristic" : "mock control";
  return (
    <div className="bg-muted/60 border-border/60 rounded-xl border px-3 py-2.5 text-center">
      <p className="text-muted-foreground text-[11px]">{label}</p>
      <p className="font-display mt-0.5 text-lg font-semibold tracking-tight">
        {value}
      </p>
      <p className="text-muted-foreground text-[11px]">{hint}</p>
      <p className="text-muted-foreground/80 mt-1 text-[9px] font-semibold tracking-wider uppercase">
        {kindLabel}
      </p>
    </div>
  );
}
