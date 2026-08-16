import { PageContainer, PageHeader } from "@/components/PageContainer";
import { MesitaLogo } from "@/components/brand/MesitaLogo";
import { MesitaMark } from "@/components/brand/MesitaMark";
import { MesitaWordmark } from "@/components/brand/MesitaWordmark";
import {
  BRAND_GEOMETRY,
  BRAND_PINK_RAMP,
  BRAND_ROLES,
  BRAND_TYPE,
} from "@/components/brand/brand-data";

// The live brand reference. Everything here renders from the SAME tokens and
// components the products use — the swatches are the shipped ramp, the logos
// are the shipped components — so this page cannot quietly disagree with what
// ships. Authored source: assets/brand/brand.json; the guide is
// the brand guide in Notion Product Rules §F. Both regenerate via `deno task sync-brand`.

export const metadata = { title: "Brand · Mesita Admin" };

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-12">
      <h2 className="font-display text-lg font-semibold tracking-tight">
        {title}
      </h2>
      {hint && (
        <p className="text-muted-foreground mt-1.5 max-w-3xl text-[13px] leading-relaxed">
          {hint}
        </p>
      )}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Card({
  label,
  dark,
  children,
}: {
  label: string;
  dark?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="border-border overflow-hidden rounded-xl border">
      <div
        className={`flex min-h-[132px] items-center justify-center p-6 ${
          dark ? "bg-brand" : "bg-card"
        }`}
      >
        {children}
      </div>
      <p className="text-muted-foreground border-border bg-muted/40 border-t px-3 py-2 font-mono text-[11px]">
        {label}
      </p>
    </div>
  );
}

export default function BrandPage() {
  return (
    <PageContainer size="5xl">
      <PageHeader
        eyebrow="Reference"
        title="Brand"
        description="The Mesita brand as it actually ships. Every swatch and logo on this page is rendered from the generated tokens and components, so if this page looks wrong, the product looks wrong. Edit assets/brand/brand.json, then run `deno task sync-brand`."
      />

      <Section
        title="Lockups"
        hint="Horizontal is the default — headers, nav, email. Stacked is for splash, auth panes, share cards, and print. Size by height; colour by text colour."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Card label='<MesitaLogo variant="horizontal" />'>
            <MesitaLogo
              variant="horizontal"
              className="text-primary h-9 w-auto"
            />
          </Card>
          <Card label='variant="horizontal" · on --gradient-brand' dark>
            <MesitaLogo
              variant="horizontal"
              className="h-9 w-auto text-white"
            />
          </Card>
          <Card label='<MesitaLogo variant="stacked" />'>
            <MesitaLogo variant="stacked" className="text-primary h-24 w-auto" />
          </Card>
          <Card label='variant="stacked" · on --gradient-brand' dark>
            <MesitaLogo variant="stacked" className="h-24 w-auto text-white" />
          </Card>
        </div>
      </Section>

      <Section
        title="Mark and wordmark"
        hint={`The flame alone carries the brand wherever the name is already on screen. Its area centroid sits at ${Math.round(
          BRAND_GEOMETRY.markOpticalCenterPct * 1000,
        ) / 10}% of its height — bottom-heavy — which is what the horizontal lockup aligns to, not the middle of its box.`}
      >
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Card label="<MesitaMark /> 64px">
            <MesitaMark className="text-primary h-16 w-16" />
          </Card>
          <Card label="24px · 16px (min)">
            <div className="flex items-end gap-3">
              <MesitaMark className="text-primary h-6 w-6" />
              <MesitaMark className="text-primary h-4 w-4" />
            </div>
          </Card>
          <Card label="mark-badge.svg · iOS, OG">
            <span className="bg-pink-gradient flex h-16 w-16 items-center justify-center rounded-[22%]">
              <MesitaMark className="h-[62%] w-[62%] text-white" />
            </span>
          </Card>
          <Card label="<MesitaWordmark />">
            <MesitaWordmark className="text-primary h-6 w-auto" />
          </Card>
        </div>
      </Section>

      <Section
        title="Mesita Pink"
        hint="One pink across all seven apps. Every step is inside the sRGB gamut, so it renders the same on an sRGB laptop and a P3 phone — raising chroma past these values makes the browser clip it. Ratios are measured against white."
      >
        <div className="border-border overflow-hidden rounded-xl border">
          {BRAND_PINK_RAMP.map((s) => {
            const aaNormal = s.onWhite >= 4.5;
            const aaLarge = s.onWhite >= 3;
            return (
              <div
                key={s.step}
                className="border-border flex items-center gap-4 border-b px-4 py-2.5 last:border-b-0"
              >
                <span
                  className="border-border h-9 w-14 shrink-0 rounded-md border"
                  style={{ background: s.hex }}
                />
                <span className="w-10 shrink-0 font-mono text-[12px] font-semibold">
                  {s.step}
                </span>
                <span className="text-muted-foreground w-20 shrink-0 font-mono text-[11px]">
                  {s.hex}
                </span>
                <span className="text-muted-foreground hidden shrink-0 font-mono text-[11px] sm:inline">
                  {s.oklch}
                </span>
                <span className="ml-auto shrink-0 text-right font-mono text-[11px]">
                  <span className="text-muted-foreground">
                    {s.onWhite.toFixed(2)}:1
                  </span>
                  <span
                    className={`ml-2 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                      aaNormal
                        ? "bg-emerald-100 text-emerald-800"
                        : aaLarge
                          ? "bg-amber-100 text-amber-800"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {aaNormal ? "AA" : aaLarge ? "AA large" : "decorative"}
                  </span>
                </span>
              </div>
            );
          })}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {BRAND_ROLES.map((r) => (
            <div key={r.token} className="border-border rounded-xl border p-4">
              <p className="font-mono text-[12px] font-semibold">{r.token}</p>
              {r.ref && (
                <p className="text-muted-foreground mt-0.5 font-mono text-[11px]">
                  → {r.ref}
                </p>
              )}
              <p className="text-muted-foreground mt-2 text-[12px] leading-relaxed">
                {r.use}
              </p>
            </div>
          ))}
        </div>

        <div className="border-border mt-4 rounded-xl border p-4">
          <p className="text-[13px] font-semibold">The rule that bites</p>
          <p className="text-muted-foreground mt-1.5 text-[12.5px] leading-relaxed">
            Mesita Pink is 3.66:1 on white — AA for large text and UI
            components, <strong>not</strong> for body text. White on a pink
            button needs ≥16px semibold. Pink text on white at body size must
            use <code className="font-mono">--brand-pink-text</code>.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className="bg-primary rounded-lg px-3 py-2 text-[15px] font-semibold text-white">
              Correct — 16px semibold
            </span>
            <span className="bg-primary rounded-lg px-3 py-2 text-[11px] font-normal text-white opacity-90">
              Too small — fails AA
            </span>
            <span
              className="text-[13px] font-medium"
              style={{ color: "var(--brand-pink-text)" }}
            >
              Pink body text uses 600
            </span>
          </div>
        </div>
      </Section>

      <Section
        title="Gradients"
        hint="Both had endpoints outside sRGB and were being silently clipped, which is why the pink drifted between displays. Both are now snapped to the chroma ceiling at their lightness."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="border-border overflow-hidden rounded-xl border">
            <div className="bg-pink-gradient h-24" />
            <p className="text-muted-foreground border-border bg-muted/40 border-t px-3 py-2 font-mono text-[11px]">
              --gradient-pink · .bg-pink-gradient · .btn-primary
            </p>
          </div>
          <div className="border-border overflow-hidden rounded-xl border">
            <div className="bg-brand h-24" />
            <p className="text-muted-foreground border-border bg-muted/40 border-t px-3 py-2 font-mono text-[11px]">
              --gradient-brand · .bg-brand (was --gradient-peacock)
            </p>
          </div>
        </div>
      </Section>

      <Section title="Typography">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="border-border rounded-xl border p-5">
            <p className="font-display text-3xl font-semibold tracking-tight">
              Descubre, reserva
            </p>
            <p className="text-muted-foreground mt-3 font-mono text-[11px]">
              {BRAND_TYPE.display.family} · --font-display
            </p>
            <p className="text-muted-foreground mt-1 text-[12px]">
              {BRAND_TYPE.display.use}
            </p>
          </div>
          <div className="border-border rounded-xl border p-5">
            <p className="text-base">
              The quick brown fox jumps over the lazy dog.
            </p>
            <p className="text-muted-foreground mt-3 font-mono text-[11px]">
              {BRAND_TYPE.body.family} · --font-body
            </p>
            <p className="text-muted-foreground mt-1 text-[12px]">
              {BRAND_TYPE.body.use}
            </p>
          </div>
        </div>
      </Section>

      <Section
        title="Rules"
        hint={`Clear space: keep ${BRAND_GEOMETRY.clearSpace}× the mark's width free on every side. Minimum sizes: horizontal ${BRAND_GEOMETRY.minSize.horizontalPx}px wide, stacked ${BRAND_GEOMETRY.minSize.stackedPx}px, bare mark ${BRAND_GEOMETRY.minSize.markPx}px.`}
      >
        <ul className="text-muted-foreground grid grid-cols-1 gap-2 text-[13px] leading-relaxed sm:grid-cols-2">
          {[
            "Don't rebuild the wordmark as live text — it's outlines so it can't reflow when Fraunces fails to load.",
            "Don't colour the mark and wordmark differently from each other.",
            "Don't put the pink logo on a pink surface — use the white one.",
            "Don't rotate, skew, shadow, outline, or squash it.",
            "Don't set the flame in a circle — the badge is a rounded square; a circle crops the wisps.",
            "Don't use an emoji as the logo. 🦚 and 🌲 shipped as the brand mark across four apps until this system replaced them.",
          ].map((rule) => (
            <li
              key={rule}
              className="border-border rounded-lg border px-3.5 py-2.5"
            >
              {rule}
            </li>
          ))}
        </ul>
      </Section>
    </PageContainer>
  );
}
