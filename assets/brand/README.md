# Mesita brand assets

Canonical brand marks — the shared source of truth for every app and doc. Apps keep their own optimized copies (favicons, `public/` icons, splash screens); when the brand changes, update **here first**, then propagate to the apps in the same PR.

| File (per format dir: `svg/` `png/` `pdf/`) | Variant |
| --- | --- |
| `logo-color` | Full-color mark on transparent background |
| `logo-color-bg` | Full-color mark on brand background |
| `logo-white` | White mark on transparent (for dark/photo surfaces) |
| `logo-black` | Black mark on transparent (for light surfaces) |
| `png/logo-padded.png` | Padded square export (marketplace/app listings) |
| `favicon/browser.png` · `favicon/iphone.png` | Favicon exports |

Prefer `svg/` for anything on the web; `png/` for raster contexts; `pdf/` for print. Renamed to kebab-case 2026-07-11 (MESITA-459) from the original "Logo Files" export (`Color logo - no background`, etc.).
