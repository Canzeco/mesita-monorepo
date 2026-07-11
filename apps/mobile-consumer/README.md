# Mesita — Consumer Mobile App

Native iOS/Android consumer app for [Mesita](https://mesita.ai), built with Expo (SDK 57), Expo Router, NativeWind, TanStack Query, and Supabase (Edge Functions only — clients never touch the DB). This is the mobile port of `mesita-web-consumer`.

## Get started

```bash
pnpm install
cp .env.example .env
pnpm start        # Expo dev server (QR for device, i for iOS sim, w for web)
```

Useful scripts:

| Script | What |
| --- | --- |
| `pnpm start` | Expo dev server |
| `pnpm web` | Dev server, web target |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | `expo lint` |
| `npx expo export --platform web` | Production web bundle (CI smoke build) |

## Architecture in one breath

Expo Router five tabs (Home / Search / Rewards / Reservations / Me) behind a session gate (`src/app/index.tsx`): phone-OTP auth → `consumer-web-signin-phone` EF → onboard gate (`full_name && birthday && sex`) → tabs. All data flows through Supabase Edge Functions via `src/lib/ef.ts` (ported verbatim from the web app). Design tokens in `tailwind.config.js` + `src/constants/brand.ts` are copied values from the web app's `globals.css` — light theme only.

Agent rules and hard constraints: see [CLAUDE.md](CLAUDE.md). Roadmap: Linear project **Mobile Consumer App**.

## Releases

EAS Build/Submit/Update, two channels (`development`, `production`), OTA for JS-only fixes, iOS-first. Not configured yet — gated on the Apple Developer account and bundle-ID blessing (`com.mesita.consumer`, staged in `app.json`).
