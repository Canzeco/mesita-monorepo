# Mesita brand assets

The canonical brand. **[`BRAND.md`](./BRAND.md) is the guide** — read that for the rules (clear space, contrast, do/don't). This file is just the map of what's in here.

## Source of truth

**`brand.json`** — colour ramp, typography, logo geometry, and the two brand path outlines. Hand-edited; everything else in this directory and in the apps is generated from it.

```bash
deno task sync-brand          # regenerate everything
deno task sync-brand:check    # verify (CI runs this; drift fails the build)
```

`sync-brand` writes: the SVGs below · `tokens.css` · the `BRAND-TOKENS` block inside each web app's `globals.css` · `src/components/brand/*` in all seven apps · each app's `public/brand/*` and `src/app/icon.svg` · the mobile Tailwind and constants blocks.

Files carrying a `GENERATED …` header or sitting between `BRAND-TOKENS` markers are **never** hand-edited — change `brand.json` and re-run.

## What's here

| | |
| --- | --- |
| `svg/mark` | The flame alone — app icons, favicons, the Home tab |
| `svg/wordmark` | "mesita." alone |
| `svg/logo-horizontal` | **Default lockup.** Mark beside wordmark — headers, nav, email |
| `svg/logo-stacked` | Mark above wordmark — splash, auth, share cards, print |
| `svg/mark-badge` | White flame on a pink rounded square — iOS icons, OG images |
| `tokens.css` | The readable original of the brand token layer |

Each logo ships in four fills: **no suffix** = `currentColor` (use this in code), `-color` = brand pink, `-black`, `-white`. Prefer `svg/` on the web, `png/` for raster, `pdf/` for print.

`favicon/browser.png` + `favicon/iphone.png` are the exports for anything that can't take an SVG.

`png/` and `pdf/` are rebuilt by `node scripts/render-brand-raster.mjs` (needs local Chrome; not run in CI).

## History

Renamed to kebab-case 2026-07-11 (MESITA-459) from the original "Logo Files" export. Rebuilt as a generated system in the brand-system pass: the artwork moved off a 3171×2784 logo-maker export onto measured geometry, the brand pink was unified on `#fb2b7b` (the logo files had been carrying a different `#f34e7a`), and the flat `logo-color` / `logo-color-bg` variants were replaced by the horizontal/stacked lockups above. For "logo on a brand background", use a `-white` lockup on a pink surface rather than a baked-in background.
