<!-- GENERATED — scripts/sync-rules.ts mirrors this file from its sibling CLAUDE.md. Edit CLAUDE.md (root: below its END marker) or scripts/rules-quickstart.md — NEVER this file. -->
# apps/mobile-business — native business app

> Read root [`CLAUDE.md`](../../CLAUDE.md) first — the quickstart; Notion holds the deep docs. Package-specific rules only below.

**Status: scaffold only.** A fresh Expo SDK 57 app (React Native · Expo Router · NativeWind) wired to EAS, with a single placeholder route. The native business counterpart to `apps/web-business`; nothing is built yet. When building, port structure/patterns from [`apps/mobile-consumer`](../mobile-consumer) — its `CLAUDE.md` is the fuller reference.

## ALWAYS
- Clients call **Edge Functions only** — never the DB (mirror the consumer EF client `apps/mobile-consumer/src/lib/ef.ts` when you add one).
- **Light theme only.** Semantic tokens live in [tailwind.config.js](tailwind.config.js) — currently PLACEHOLDER values copied from mobile-consumer; re-derive from `apps/web-business/src/app/globals.css` when building (the business console may diverge from consumer). The `BRAND-TOKENS` block there, `src/constants/brand.ts`, and `src/components/brand/*` are **generated** from `assets/brand/brand.json` (`deno task sync-brand`) — never hand-edit them, and the brand never diverges from consumer.
- Reply in English. Mirror shipped architecture changes to Notion Product Rules same session.

## Verification (same as mobile-consumer)
- Web build only — no simulators/devices in agent sessions. Preview: Claude launch config `mobile-business` (port 8082) in `.claude/launch.json`.
- Gate every PR on: `pnpm typecheck` · `pnpm lint` · `npx expo export --platform web` (the export catches Metro/NativeWind breaks tsc can't see). CI: `mobile-business.yml`, path-filtered to `apps/mobile-business/**`.
- Real-device verification = EAS builds/TestFlight = human (Pato).

## Hard constraints (do not re-litigate)
- **pnpm hoisted linker via `pnpm-workspace.yaml`** (`nodeLinker: hoisted`). pnpm 11 IGNORES `node-linker` in `.npmrc` — without hoisting, Metro can't resolve `react-native-css-interop` and the bundle fails. Hence no root pnpm workspace: this package is its own install root.
- `app.json`: `web.output` must stay `"single"`; `userInterfaceStyle` stays `"light"`, which requires `darkMode: 'class'` in tailwind.config.js (NativeWind throws "Cannot manually set color scheme" otherwise). Migrate to `app.config.ts` only when env interpolation is needed (e.g. a Maps key), as mobile-consumer did.
- **Separate EAS project:** `@canzeco/mesita-mobile-business` (projectId `aa2fc707-f877-462e-b7a2-76f0d431dbc1`), bundle id `com.mesita.business`. One EAS project per app — never share with mobile-consumer.
- Bundle ID `com.mesita.business` is **STAGED, not blessed** — no EAS builds / store submissions until Pato confirms it and the Apple Developer account exists (both human-gated).
- No payment UI / Stripe / subscribe links (Apple review posture), same as consumer.

## Structure
- `src/app/` — Expo Router: `_layout.tsx` (Stack) + `index.tsx` (placeholder). Build real routes here.
- `src/global.css` — NativeWind entry (referenced by `metro.config.js`).
- Toolchain (`babel.config.js` · `metro.config.js` · `tailwind.config.js` · `tsconfig.json` · `eslint.config.js`) mirrors mobile-consumer; keep them in sync.
