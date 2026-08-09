# Mesita — design systems (index)

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

Token authority for each web app is that app’s `src/app/globals.css` (and `layout.tsx` fonts). The DESIGN.md files are maps (when-to-use), not second palettes.
