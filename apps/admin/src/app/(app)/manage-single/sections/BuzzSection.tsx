"use client";

import { useMemo, useState } from "react";
import { Braces, Megaphone } from "lucide-react";
import { visibilityScore } from "@/lib/business/plans";
import type { AdminPlace } from "../actions";
import { GroupLabel, SectionCard, TINT_CHIP } from "../ui";

// ════════════════════════════════════════════════════════════════════════
// Buzz — the place's potency for the recommendation engines (Swipe · Map ·
// Memo). Admin-only: the whole console sits behind the super-admin gate.
//
// DRAFT MODEL, frontend only:
//
//   buzz(d) = (visibility + importance) ÷ decay(d)      decay(d) = 1 + d/d₀
//
//   visibility  1–10  what the business bought — the live Promos score.
//   importance  1–10  consumer quality prior — Google stars weighted by
//                     review volume + a small social-proof nudge.
//   decay(d)          proximity app — potency halves every d₀ km; each
//                     engine reads distance at its own sensitivity.
// ════════════════════════════════════════════════════════════════════════

const BUZZ_MAX = 20; // V(10) + I(10) at distance 0
const BASE_D0 = 1.5; // km at which potency halves for the headline number

/** Consumer quality prior, 1–10: stars ≤6 pts, review volume ≤3 (log), social ≤1. */
function importanceScore(place: AdminPlace): number {
  const stars = place.google_stars_overall ?? 0;
  const reviews = place.google_review_count ?? 0;
  const followers = place.instagram_followers_count ?? 0;

  const starPts = (Math.max(0, Math.min(5, stars)) / 5) * 6;
  const volumePts = Math.min(3, (Math.log10(reviews + 1) / Math.log10(5000)) * 3);
  const socialPts = Math.min(1, Math.log10(followers + 1) / 5);

  return Math.max(1, Math.min(10, starPts + volumePts + socialPts));
}

/** Per-engine distance sensitivity — d₀ in km at which potency halves. */
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

  const V = visibilityScore(place);
  const I = importanceScore(place);
  const buzzAt = (d: number, d0: number = BASE_D0) => (V + I) / decay(d, d0);
  const buzz = buzzAt(km);

  const vector = useMemo(() => mockVector(place.id, 48), [place.id]);

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      {/* ── Buzz — score, distance, ingredients, engines ────────────── */}
      <SectionCard
        icon={<Megaphone className="h-4.5 w-4.5" />}
        tint="pink"
        title="Buzz"
        subtitle="Potency for the recommendation engines — Swipe, the Map and Memo. Admins only."
        action={<Pill>Draft model</Pill>}
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
          </div>
        </div>

        <p className="text-muted-foreground mt-4 font-mono text-xs">
          buzz = (visibility + importance) ÷ distance decay
        </p>

        <div className="mt-2 grid grid-cols-3 gap-2 sm:gap-3">
          <Tile label="Visibility" value={`${fmt(V, 0)}/10`} hint="Promos boost" />
          <Tile label="Importance" value={`${fmt(I)}/10`} hint="Google quality" />
          <Tile
            label="Decay"
            value={`÷${fmt(decay(km, BASE_D0), 2)}`}
            hint={`at ${fmt(km)} km`}
          />
        </div>

        <div className="mt-6">
          <GroupLabel>Engines</GroupLabel>
          <div className="mt-3 flex flex-col gap-3">
            {ENGINES.map((e) => {
              const potency = buzzAt(km, e.d0);
              return (
                <div key={e.id} className="flex items-center gap-3">
                  <p className="w-14 shrink-0 text-sm font-semibold">{e.label}</p>
                  <Meter value={potency / BUZZ_MAX} className="flex-1" />
                  <p className="text-muted-foreground w-10 shrink-0 text-right text-xs">
                    {fmt(potency)}
                  </p>
                </div>
              );
            })}
          </div>
          <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
            Same buzz, three appetites for distance — Swipe is the most local,
            Memo cares the least.
          </p>
        </div>
      </SectionCard>

      {/* ── Semantic — meaning retrieves, buzz ranks ────────────────── */}
      <SectionCard
        icon={<Braces className="h-4.5 w-4.5" />}
        tint="indigo"
        title="Semantic"
        subtitle="The place is queried by meaning — its description embedded as a vector, filtered by metadata; buzz orders what survives."
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
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="bg-muted/60 border-border/60 rounded-xl border px-3 py-2.5 text-center">
      <p className="text-muted-foreground text-[11px]">{label}</p>
      <p className="font-display mt-0.5 text-lg font-semibold tracking-tight">
        {value}
      </p>
      <p className="text-muted-foreground text-[11px]">{hint}</p>
    </div>
  );
}
