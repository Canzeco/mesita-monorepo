# Mesita — design systems (index)

**Brand — [`assets/brand/BRAND.md`](assets/brand/BRAND.md).** The logo, the pink, the type, and the rules for using them are shared by all seven apps and generated from `assets/brand/brand.json` (`deno task sync-brand`). Anything brand-level — the mark, the pink ramp, the gradients, Fraunces/Inter — is decided there, not per app.

Per-app design maps live next to the app they describe. gstack design reviews should open the package file for the surface under change.

| App | Design map | Notes |
| --- | --- | --- |
| `apps/web-admin` | [`apps/web-admin/DESIGN.md`](apps/web-admin/DESIGN.md) | Internal console — calm, dense, semantic light tokens |
| `apps/web-business` | _(none yet)_ | — |
| `apps/web-consumer` | _(none yet)_ | — |
| `apps/web-landing` | _(none yet)_ | — |
| `apps/web-check` | _(none yet)_ | — |
| `apps/mobile-consumer` | _(none yet)_ | Must look alike to web-consumer when written |
| `apps/mobile-business` | _(none yet)_ | Scaffold only |

Token authority for each web app is that app’s `src/app/globals.css` (and `layout.tsx` fonts) — **except** the `BRAND-TOKENS` block inside it, which is generated from `assets/brand/brand.json` and must not be hand-edited. The DESIGN.md files are maps (when-to-use), not second palettes.

Live reference: **`/brand`** in web-admin renders the marks, the ramp with measured contrast, and the lockup rules straight from the shipped tokens.
