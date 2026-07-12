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
// DRAFT MODEL v4, frontend only — TWO LANES, each a single product
// (MESITA-598):
//
//   Merit Lane = Merit Score × Match Score      earned / organic
//   Promo Lane = Promo Score × Match Score      bought / paid
//
//   Merit Score  0–10  earned quality — reputation + magnetism (the non-paid
//                      signals) × momentum. What the place is worth on its
//                      own merits.
//   Promo Score  0–10  bought placement — the live Promos score, i.e. the
//                      membership posture's Low·Mid·High·Max.
//   Match Score  0–1   ALWAYS semantic (RAG/LLM), never binary tags. Zero
//                      relevance zeroes both lanes.
//
// A place competes twice — on merit and on promo — each gated by how well it
// matches the query. No distance / right-now here; those return later.
// ════════════════════════════════════════════════════════════════════════

const SCORE_MAX = 10;

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
  // Simulated semantic match (0–1) — in production RAG computes this per
  // query (Memo's question, or the consumer's taste embedding on Swipe/Map).
  const [match, setMatch] = useState(1);

  const promoScore = visibilityScore(place); // bought placement, 0–10
  const reputation = reputationScore(place);
  const magnetism = magnetismScore(place);
  const momentum = 1; // needs snapshot history — ships with the backend
  const meritScore = Math.max(
    0,
    Math.min(10, ((reputation + magnetism) / 2) * momentum),
  );

  const meritLane = meritScore * match;
  const promoLane = promoScore * match;

  const vector = useMemo(() => mockVector(place.id, 48), [place.id]);

  const matchPct = `${Math.round(match * 100)}%`;

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

      {/* ── Buzz — two lanes, each Score × Match ─────────────────────── */}
      <SectionCard
        icon={<Megaphone className="h-4.5 w-4.5" />}
        tint="pink"
        title="Buzz"
        subtitle="Two lanes — Merit (earned) and Promo (bought). Each is its score × how well the place matches the query. Admins only."
        action={<Pill>Draft model</Pill>}
      >
        {/* Lane results */}
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Lane
            label="Merit Lane"
            sub="earned quality × match"
            score={meritLane}
            accent="sky"
          />
          <Lane
            label="Promo Lane"
            sub="bought placement × match"
            score={promoLane}
            accent="pink"
          />
        </div>

        {/* Match — the shared gate on both lanes */}
        <div className="mt-5 max-w-sm">
          <div className="flex items-baseline justify-between">
            <GroupLabel>Match Score</GroupLabel>
            <span className="text-sm font-semibold">{matchPct}</span>
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
          <p className="text-muted-foreground mt-1 text-[11px] leading-snug">
            Semantic relevance to the query (RAG) — zero match zeroes both lanes.
          </p>
        </div>

        {/* Equation strips — each lane, shown being built */}
        <div className="mt-6 flex flex-col gap-4">
          <div>
            <GroupLabel>Merit Lane</GroupLabel>
            <div className="mt-2 flex items-stretch gap-1.5 sm:gap-2">
              <EqTerm label="Merit Score" sub="earned quality" value={fmt(meritScore)} />
              <EqOp>×</EqOp>
              <EqTerm label="Match" sub="query relevance" value={matchPct} />
              <EqOp>=</EqOp>
              <EqTerm label="Merit Lane" sub="organic rank" value={fmt(meritLane)} highlight />
            </div>
          </div>
          <div>
            <GroupLabel>Promo Lane</GroupLabel>
            <div className="mt-2 flex items-stretch gap-1.5 sm:gap-2">
              <EqTerm label="Promo Score" sub="bought placement" value={fmt(promoScore)} />
              <EqOp>×</EqOp>
              <EqTerm label="Match" sub="query relevance" value={matchPct} />
              <EqOp>=</EqOp>
              <EqTerm label="Promo Lane" sub="paid rank" value={fmt(promoLane)} highlight />
            </div>
          </div>
        </div>

        {/* Merit Score breakdown — earned */}
        <div className="mt-6">
          <div className="flex items-baseline justify-between gap-3">
            <GroupLabel>Merit Score · earned</GroupLabel>
            <p className="text-muted-foreground font-mono text-[11px]">
              (reputation + magnetism) / 2 × momentum = {fmt(meritScore)}
            </p>
          </div>
          <p className="text-muted-foreground mt-1 text-[11px] leading-snug">
            What the place is worth on its own merits — no money involved.
          </p>
          <div className="mt-2 grid grid-cols-3 gap-2 sm:gap-3">
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

        {/* Promo Score breakdown — bought */}
        <div className="mt-5">
          <div className="flex items-baseline justify-between gap-3">
            <GroupLabel>Promo Score · bought</GroupLabel>
            <p className="text-muted-foreground font-mono text-[11px]">
              live Promos placement = {fmt(promoScore)}
            </p>
          </div>
          <p className="text-muted-foreground mt-1 text-[11px] leading-snug">
            The membership posture&apos;s placement — Low · Mid · High · Max —
            set on the Promos tab.
          </p>
          <div className="mt-2 grid grid-cols-3 gap-2 sm:gap-3">
            <Tile
              label="Promotional Visibility"
              value={`${fmt(promoScore, 0)}/10`}
              hint="bought · Promos"
              kind="live"
            />
          </div>
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

// A lane's result — big score + meter, tinted to the lane (Merit = sky,
// Promo = pink) so the two rank paths read apart at a glance.
function Lane({
  label,
  sub,
  score,
  accent,
}: {
  label: string;
  sub: string;
  score: number;
  accent: "sky" | "pink";
}) {
  const tint =
    accent === "sky"
      ? "border-sky-500/30 bg-sky-500/[0.04]"
      : "border-pink-500/30 bg-pink-500/[0.04]";
  const labelText = accent === "sky" ? "text-sky-700" : "text-pink-700";
  return (
    <div className={"flex flex-col gap-2 rounded-2xl border p-4 " + tint}>
      <p
        className={
          "text-[10px] font-bold tracking-[0.14em] uppercase " + labelText
        }
      >
        {label}
      </p>
      <div className="flex items-end gap-2">
        <p className="font-display text-4xl leading-none font-semibold tracking-tight tabular-nums">
          {fmt(score)}
        </p>
        <p className="text-muted-foreground pb-0.5 text-xs">/ {SCORE_MAX}</p>
      </div>
      <Meter value={score / SCORE_MAX} />
      <p className="text-muted-foreground text-[11px] leading-snug">{sub}</p>
    </div>
  );
}

// One term in the plain-language lane equation — value big, human sublabel.
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
