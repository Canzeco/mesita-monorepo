"use client";

import { useMemo, useState } from "react";
import { Braces, Eye, MapPin, Megaphone, Radar, Star } from "lucide-react";
import { visibilityScore } from "@/lib/business/plans";
import type { AdminPlace } from "../actions";
import { GroupLabel, SectionCard, TINT_CHIP } from "../ui";

// ════════════════════════════════════════════════════════════════════════
// Buzz — the place's potency for the recommendation engines (Swipe · Memo ·
// Map). Admin-only by nature: the whole console sits behind the super-admin
// gate; businesses and consumers never see this.
//
// DRAFT MODEL, frontend only — every number is computed client-side from the
// loaded place so the idea can be polished before anything ships to the
// engines:
//
//   buzz(d) = (visibility + importance) ÷ decay(d)      decay(d) = 1 + d/d₀
//
//   visibility  1–10  what the business bought — the live Promos score
//                     (plan floor + discount generosity + ticket cap).
//   importance  1–10  consumer quality prior — Google stars weighted by
//                     review volume plus a small social-proof nudge. Keeps
//                     weak places out of the engines.
//   decay(d)          proximity is the product — potency halves every d₀ km;
//                     each engine reads distance at its own sensitivity.
// ════════════════════════════════════════════════════════════════════════

const BUZZ_MAX = 20; // V(10) + I(10) at distance 0
const BASE_D0 = 1.5; // km at which potency halves for the headline number

/** Consumer quality prior, 1–10. Stars carry most of it; volume earns trust. */
function importanceScore(place: AdminPlace): number {
  const stars = place.google_stars_overall ?? 0;
  const reviews = place.google_review_count ?? 0;
  const followers = place.instagram_followers_count ?? 0;

  // 0–6 from the rating itself, 0–3 from review volume (logarithmic — 5,000
  // reviews maxes it), 0–1 from social proof (100k followers maxes it).
  const starPts = (Math.max(0, Math.min(5, stars)) / 5) * 6;
  const volumePts = Math.min(3, (Math.log10(reviews + 1) / Math.log10(5000)) * 3);
  const socialPts = Math.min(1, Math.log10(followers + 1) / 5);

  return Math.max(1, Math.min(10, starPts + volumePts + socialPts));
}

/** Per-engine distance sensitivity — d₀ in km at which potency halves. */
const ENGINES = [
  {
    id: "swipe",
    label: "Swipe",
    d0: 1.5,
    hint: "Deck ordering on Home — the most local surface; buzz decides who shows up first.",
  },
  {
    id: "map",
    label: "Map",
    d0: 3,
    hint: "Pin prominence on Search — mid-range; high-buzz places read louder on the map.",
  },
  {
    id: "memo",
    label: "Memo",
    d0: 5,
    hint: "Retrieval re-rank for the concierge — meaning first, buzz breaks the ties.",
  },
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

  const V = visibilityScore(place);
  const I = importanceScore(place);
  const buzzAt = (d: number, d0: number = BASE_D0) => (V + I) / decay(d, d0);
  const buzz = buzzAt(km);

  const vector = useMemo(() => mockVector(place.id, 48), [place.id]);

  const meta: { label: string; value: string | null }[] = [
    { label: "Category", value: place.category_label ?? place.category },
    { label: "Zone", value: place.zone },
    { label: "City", value: place.city },
    {
      label: "Price",
      value: place.price_level ? "$".repeat(place.price_level) : null,
    },
  ];

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      {/* ── Hero — the live formula ─────────────────────────────────── */}
      <SectionCard
        icon={<Megaphone className="h-4.5 w-4.5" />}
        tint="pink"
        title="Buzz"
        subtitle="Potency for the recommendation engines — Swipe, Memo and the Map. Hidden from businesses and consumers; admins only."
        action={<DraftPill />}
      >
        <div className="mt-5 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-end gap-3">
              <p className="font-display text-5xl font-semibold tracking-tight">
                {fmt(buzz)}
              </p>
              <p className="text-muted-foreground pb-1.5 text-sm">/ {BUZZ_MAX}</p>
            </div>
            <Meter value={buzz / BUZZ_MAX} className="mt-3 w-56" />
            <p className="text-muted-foreground mt-3 font-mono text-xs">
              buzz = (visibility {fmt(V, 0)} + importance {fmt(I)}) ÷ decay(
              {fmt(km)}&nbsp;km) {fmt(decay(km, BASE_D0), 2)}
            </p>
          </div>

          <div className="w-full max-w-sm">
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
            <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
              Mesita is a proximity app — drag to see what this place is worth
              to a consumer standing that far away.
            </p>
          </div>
        </div>
      </SectionCard>

      <div className="grid gap-4 sm:gap-5 md:grid-cols-2">
        {/* ── Visibility — what the business bought ─────────────────── */}
        <SectionCard
          icon={<Eye className="h-4.5 w-4.5" />}
          tint="violet"
          title={`Visibility · ${fmt(V, 0)}/10`}
          subtitle="How much the business has boosted on Mesita — the live Promos score."
        >
          <div className="mt-4 flex flex-col gap-2.5">
            <StatRow
              label="Plan"
              value={place.plan ? place.plan.replace(/_/g, " ") : "free"}
            />
            <StatRow
              label="Reward rates"
              value={[
                place.welcome_free_rate,
                place.welcome_premium_rate,
                place.free_rate,
                place.premium_rate,
              ]
                .map((r) => (typeof r === "number" ? `${r}%` : "off"))
                .join(" · ")}
            />
            <StatRow
              label="Monthly cap"
              value={
                place.monthly_promo_cap == null
                  ? "No cap"
                  : `MX$${place.monthly_promo_cap.toLocaleString("en-US")}`
              }
            />
          </div>
          <Meter value={V / 10} className="mt-4" />
          <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
            Same 1–10 the Place tab shows: plan floor + discount generosity +
            ticket cap. Edit it on the Promos tab — buzz follows.
          </p>
        </SectionCard>

        {/* ── Importance — the consumer quality prior ───────────────── */}
        <SectionCard
          icon={<Star className="h-4.5 w-4.5" />}
          tint="amber"
          title={`Importance · ${fmt(I)}/10`}
          subtitle="How much the place matters to consumers — so the engines never push weak places."
        >
          <div className="mt-4 flex flex-col gap-2.5">
            <StatRow
              label="Google rating"
              value={
                place.google_stars_overall != null
                  ? `${fmt(place.google_stars_overall)} ★`
                  : "No rating yet"
              }
            />
            <StatRow
              label="Google reviews"
              value={
                place.google_review_count != null
                  ? place.google_review_count.toLocaleString("en-US")
                  : "—"
              }
            />
            <StatRow
              label="Instagram followers"
              value={
                place.instagram_followers_count != null
                  ? place.instagram_followers_count.toLocaleString("en-US")
                  : "—"
              }
            />
          </div>
          <Meter value={I / 10} className="mt-4" />
          <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
            Draft prior: stars carry up to 6 pts, review volume up to 3
            (logarithmic — 5,000 reviews maxes it), social proof up to 1.
          </p>
        </SectionCard>

        {/* ── Proximity — the divisor ───────────────────────────────── */}
        <SectionCard
          icon={<MapPin className="h-4.5 w-4.5" />}
          tint="sky"
          title="Proximity decay"
          subtitle="Closer places are better — potency divides by distance."
        >
          <DecayCurve V={V} I={I} km={km} />
          <div className="mt-3 grid grid-cols-3 gap-2">
            {[0.5, 2, 5].map((d) => (
              <div key={d} className="bg-muted/60 border-border/60 rounded-xl border px-3 py-2 text-center">
                <p className="text-muted-foreground text-[11px]">at {d} km</p>
                <p className="text-sm font-semibold">{fmt(buzzAt(d))}</p>
              </div>
            ))}
          </div>
          <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
            decay(d) = 1 + d/1.5 km — worth half at 1.5 km, a third at 3 km.
            {place.lat != null && place.lng != null
              ? " Anchored at the place's stored coordinates."
              : " This place has no coordinates yet — distance can't be scored live."}
          </p>
        </SectionCard>

        {/* ── Engines — where buzz is spent ─────────────────────────── */}
        <SectionCard
          icon={<Radar className="h-4.5 w-4.5" />}
          tint="emerald"
          title="Engines"
          subtitle="The three consumers of buzz, each with its own distance sensitivity."
        >
          <div className="mt-4 flex flex-col gap-3.5">
            {ENGINES.map((e) => {
              const potency = buzzAt(km, e.d0);
              return (
                <div key={e.id}>
                  <div className="flex items-baseline justify-between">
                    <p className="text-sm font-semibold">{e.label}</p>
                    <p className="text-muted-foreground text-xs">
                      {fmt(potency)} / {BUZZ_MAX} at {fmt(km)} km
                    </p>
                  </div>
                  <Meter value={potency / BUZZ_MAX} className="mt-1.5" />
                  <p className="text-muted-foreground mt-1.5 text-xs leading-relaxed">
                    {e.hint}
                  </p>
                </div>
              );
            })}
          </div>
        </SectionCard>
      </div>

      {/* ── Semantic profile — the RAG side ─────────────────────────── */}
      <SectionCard
        icon={<Braces className="h-4.5 w-4.5" />}
        tint="indigo"
        title="Semantic profile"
        subtitle="Buzz ranks; meaning retrieves. The place must be queryable mathematically — its description embedded as a vector, plus hard metadata filters."
        action={<DraftPill label="Mock — no vectors stored yet" />}
      >
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <div>
            <GroupLabel>Embedding text</GroupLabel>
            {place.description ? (
              <p className="bg-muted/60 border-border/60 mt-2 rounded-xl border px-4 py-3 text-sm leading-relaxed">
                {place.description}
              </p>
            ) : (
              <p className="text-muted-foreground bg-muted/60 border-border/60 mt-2 rounded-xl border px-4 py-3 text-sm italic">
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
            <GroupLabel>Vector preview</GroupLabel>
            <div className="bg-muted/60 border-border/60 mt-2 flex border h-16 items-end gap-px overflow-hidden rounded-xl px-3 pt-2">
              {vector.map((v, i) => (
                <span
                  key={i}
                  className="w-full rounded-t-sm bg-indigo-500/50"
                  style={{ height: `${8 + v * 84}%` }}
                />
              ))}
            </div>
            <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
              48 of 1,536 dims, derived from the place id as a stand-in — the
              real vector comes from embedding the text on the left.
            </p>
            <div className="mt-4">
              <GroupLabel>Metadata filters</GroupLabel>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {meta
                  .filter((m) => m.value)
                  .map((m) => (
                    <span
                      key={m.label}
                      className="bg-muted text-muted-foreground rounded-full px-2.5 py-1 text-[11px] font-medium"
                    >
                      {m.label}: <span className="text-foreground">{m.value}</span>
                    </span>
                  ))}
              </div>
              <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
                A query hits meaning first (vector similarity), filters on
                metadata, then buzz orders what survives.
              </p>
            </div>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

// ── Local bits ─────────────────────────────────────────────────────────

function DraftPill({ label = "Draft model — frontend only" }: { label?: string }) {
  return (
    <span className="bg-muted text-muted-foreground rounded-full px-3 py-1.5 text-[11px] font-semibold">
      {label}
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

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="truncate text-sm font-medium capitalize">{value}</p>
    </div>
  );
}

/** buzz(d) over 0–8 km as a small inline chart, with the slider's marker. */
function DecayCurve({ V, I, km }: { V: number; I: number; km: number }) {
  const W = 320;
  const H = 96;
  const PAD = 6;
  const maxKm = 8;

  const xAt = (d: number) => PAD + (d / maxKm) * (W - PAD * 2);
  const yAt = (d: number) =>
    H - PAD - ((V + I) / decay(d, BASE_D0) / BUZZ_MAX) * (H - PAD * 2);

  const pts: string[] = [];
  for (let d = 0; d <= maxKm; d += 0.25) {
    pts.push(`${pts.length === 0 ? "M" : "L"}${fmt(xAt(d))},${fmt(yAt(d))}`);
  }

  return (
    <div className="mt-4">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label="Buzz vs distance curve"
      >
        <line
          x1={PAD}
          y1={H - PAD}
          x2={W - PAD}
          y2={H - PAD}
          className="stroke-border"
          strokeWidth="1"
        />
        <path d={pts.join(" ")} fill="none" className="stroke-sky-500" strokeWidth="2" />
        <circle cx={xAt(km)} cy={yAt(km)} r="4" className="fill-sky-500" />
      </svg>
      <div className="text-muted-foreground flex justify-between text-[10px]">
        <span>0 km</span>
        <span>4 km</span>
        <span>8 km</span>
      </div>
    </div>
  );
}
