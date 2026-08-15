# Mesita — brand system

The rules for how Mesita looks. `brand.json` is the machine-readable source; this file is the reasoning behind it. When the two disagree, `brand.json` wins — it is what actually ships.

Change the brand by editing **`assets/brand/brand.json`**, then running:

```bash
deno task sync-brand
```

That regenerates the logo assets, the token blocks inside every app's `globals.css`, the logo components for all seven apps, the favicons, and the mobile constants. CI runs `deno task sync-brand:check` and fails the build if anything drifted. Never hand-edit a file that says it was generated.

---

## 1. The mark

A pink flame with a teardrop counter cut out of its centre.

| Asset | Use |
| --- | --- |
| `svg/mark.svg` | The flame alone. App icons, favicons, avatars, the Home tab, anywhere the name is already on screen. |
| `svg/wordmark.svg` | "mesita." alone. Rare — only when the flame appears separately in the same view. |
| `svg/logo-horizontal.svg` | **The default.** Mark beside wordmark. Headers, nav bars, email signatures, docs. |
| `svg/logo-stacked.svg` | Mark above wordmark. Splash screens, auth panes, share cards, print, anything square-ish. |
| `svg/mark-badge.svg` | White flame on a pink rounded square. iOS home screens, app-store tiles, OG images — anywhere transparency renders badly. |

Each comes in four fills: no suffix = `currentColor` (what code should use), `-color` = brand pink, `-black`, `-white`. PNG and PDF exports of each live in `png/` and `pdf/`.

### Geometry

The lockups are not eyeballed. Both were built off measured path geometry:

- The mark's ink fills `x 13.3–86.7, y 4.8–95.0` inside its `0 0 100 100` viewBox — optically centred.
- Its **area centroid is at y=55.2**, not y=50. The flame is bottom-heavy: the round body carries most of the ink, the wisps at the top carry little. Anything aligning to the mark aligns to **55.9% of its height**, never the middle of its box.
- In the horizontal lockup the wordmark's **x-height band** (not its bounding box — the i-dot and the period would skew that) is centred on that centroid. Wordmark height is 0.44× the mark's; the gap is 0.20× the mark's width.
- The stacked lockup preserves the original artwork's proportions exactly.

### Clear space and minimum size

Keep **0.35 × the mark's width** clear on all four sides. Nothing — text, rules, image edges, other logos — enters that band.

| | Minimum | Comfortable |
| --- | --- | --- |
| Horizontal lockup | 56px wide | 80px+ |
| Stacked lockup | 64px wide | — |
| Bare mark | 16px | — |

These were checked by rendering the lockup into the actual headers, not guessed. At 56px wide (a 20px-tall header logo) the wordmark is legible but tight; at 47px it stops being readable. **Below ~80px, prefer the bare mark** over the lockup — it stays crisp at any size and the surrounding chrome usually names the product anyway.

### Don't

- Don't rebuild the wordmark as live text. It is outlines on purpose, so it can't reflow when Fraunces fails to load.
- Don't recolour the mark and wordmark differently from each other.
- Don't put the pink logo on a pink surface — use `-white`.
- Don't rotate, skew, add a drop shadow, outline it, or squash the aspect ratio.
- Don't set the flame inside a circle. The badge is a **rounded square**; a circle crops the wisps.
- Don't use an emoji as the logo. This is not hypothetical — 🦚 and 🌲 shipped as the brand mark across four apps until this system replaced them.

---

## 2. Colour

### Mesita Pink

**`oklch(0.65 0.24 5)` · `#fb2b7b`**

One pink, everywhere. Before this system there were three: the logo files carried `#f34e7a`, the mobile mark hardcoded `#fb2b7b`, and the web token resolved to `#fb2b7b`. The product's pink won and the logo files were re-filled to match.

The full ramp is `--brand-pink-50` … `--brand-pink-950`. Every step is **inside the sRGB gamut**, so the same pink renders on an sRGB laptop and a P3 phone. Raising chroma above the documented values pushes a step out of gamut, where the browser clips it unpredictably — check before you change one.

| Token | Step | Hex | On white | Use |
| --- | --- | --- | --- | --- |
| `--brand-pink` | 500 | `#fb2b7b` | 3.66:1 | The brand. Logo, primary buttons, active states, focus rings. |
| `--brand-pink-text` | 600 | `#e10069` | 4.77:1 | Pink **text and links at body size** on white. |
| `--brand-pink-deep` | 700 | `#bb0056` | 6.47:1 | Pressed states, pink on tinted surfaces, print. |

### The contrast rule that actually bites

Mesita Pink is **3.66:1 against white**. That passes WCAG AA for *large* text and UI components; it **fails** AA for normal text.

- White text on a pink button is fine at **≥16px semibold** or ≥19px regular. Below that it fails — the button is legal, the label is not.
- Pink text on a white background at body size must use `--brand-pink-text` (600), never `--brand-pink`.

### Gradients

`--gradient-pink` — the CTA / brand surface (`.bg-pink-gradient`, `.btn-primary`).
`--gradient-brand` — three-stop wash for full-bleed panels and tiles (`.bg-brand`): auth panes, 404, badges.

Both had endpoints outside sRGB and were being silently clipped, which is why the pink drifted between displays. Both are now snapped to the chroma ceiling at their lightness.

For gradient-filled **text**, use the `text-pink-gradient` utility. Do not hand-compose `bg-pink-gradient bg-clip-text text-transparent` — the `background:` shorthand resets `background-clip` and the glyphs come out invisible.

---

## 3. Typography

| Role | Family | Where |
| --- | --- | --- |
| Display | **Fraunces** | `h1`–`h3`, `.font-display`, the wordmark's own drawing. Tracking `-0.015em`. |
| Body | **Inter** | Everything else. |

Loaded through `next/font/google` in each web app's `layout.tsx`, and as `Fraunces_*` / `Inter_*` on mobile. All seven apps already agree here — keep it that way.

---

## 4. Using it in code

Every app has the same three components at `src/components/brand/`:

```tsx
import { MesitaLogo } from "@/components/brand/MesitaLogo";

// Header — inherits colour from the parent
<Link href="/" className="text-primary">
  <MesitaLogo variant="horizontal" className="h-7 w-auto" />
</Link>

// On a pink or photographic surface
<MesitaLogo variant="stacked" className="h-16 w-auto text-white" />

// Decorative, when adjacent text already says "Mesita"
<MesitaLogo title={null} className="h-5 w-auto" />
```

Size with **height**; the viewBox carries the aspect ratio. Colour with **text colour**; the art is `currentColor` throughout.

`MesitaMark` is the bare flame — it accepts (and ignores) `strokeWidth` so it can sit in a row of lucide icons, as it does in the consumer bottom nav.

React Native is the same, minus `currentColor`:

```tsx
import { MesitaLogo } from '@/components/brand/MesitaLogo';
<MesitaLogo variant="horizontal" width={160} color={BRAND_PINK} />
```

---

## 5. Regenerating the raster and PDF exports

The PNG and PDF files are conveniences built from the SVGs. They are **not** part of `sync-brand` and **not** built in CI, because they need a local browser:

```bash
node scripts/render-brand-raster.mjs
```

Requires Google Chrome or Chromium. PNGs come out transparent; PDFs stay vector. If you have neither, re-export from a design tool — `assets/brand/svg/` is the source in every case.
