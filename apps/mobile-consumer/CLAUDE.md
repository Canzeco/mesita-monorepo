# apps/mobile-consumer — native consumer app

> Monorepo-wide rules: root [`CLAUDE.md`](../../CLAUDE.md) (the quickstart) — read it first. This file adds only package-specific rules.

Native consumer app (Expo SDK 57 · React Native · Expo Router · NativeWind) — the mobile port of `apps/web-consumer`.

## ALWAYS
- Clients call **Edge Functions only** — never the DB. The EF client is [src/lib/ef.ts](src/lib/ef.ts), ported **verbatim** from `apps/web-consumer/src/lib/api/_invoke.ts`; when one changes, update the other **in the same PR** (they live in the same repo now).
- **Light theme only.** Semantic tokens live in [tailwind.config.js](tailwind.config.js) + [src/constants/brand.ts](src/constants/brand.ts) — copied VALUES from `apps/web-consumer/src/app/globals.css` (web is Tailwind v4 CSS-first, this package is NativeWind 4 + Tailwind 3.4; they cannot share config). If web tokens change, re-copy here **in the same PR**.
- Reply in English. Mirror shipped architecture changes to Notion Product Rules same session.
- Premium visual bar: branded gradients (expo-linear-gradient + `GRADIENTS`), tinted icon circles, no wireframe stacks.

## Mobile-specific verification (replaces "verify via Vercel")
- Agents verify via the **web build**: `npx expo start --web` — Claude Preview launch config `mobile-consumer` (port 8081) in the repo `.claude/launch.json`. No simulators/devices in agent sessions.
- Gate every PR on: `pnpm typecheck` · `pnpm lint` · `npx expo export --platform web` (the export catches Metro/NativeWind breaks tsc can't see). CI: `mobile-consumer.yml`, path-filtered to `apps/mobile-consumer/**`.
- Real-device verification = EAS builds/TestFlight = human (Pato).

## Hard constraints (learned/decided — do not re-litigate)
- **Web look + feature parity (MESITA-564 / MESITA-578, 2026-07-12).** Mobile must look **very alike** to `apps/web-consumer` — same IA, screens, visual language, tokens, brand moments — and ship **exactly the same features/functionalities**. "Similar-not-identical" is superseded. Default kit: **NativeWind semantic classes** + targeted **`@rn-primitives`** (Portal / Switch / Slot) for a11y. Shared primitives live under `src/components/ui/` (Button, TextField, FullScreenSheet, BoxRow, SegmentNav, …). Icons: **lucide-react-native only** (no MaterialCommunityIcons / `@expo/vector-icons` for UI). **`react-native-paper` is retired** (MESITA-582) — never re-add the dep or `PaperProvider`. Product-specific composites (SwipeDeck, Ask AI, MesitaMark, map) stay custom. Sole deliberate exception: **no Stripe/subscribe checkout UI** in the iOS binary (Apple review) — Premium/Class UI still match web; subscribe happens on web. Keep Home/Search/Me/Rewards/Reservations/place detail aligned with the web surface (including parked-vs-live: if web parks Memo/Social, mobile parks them too; if web has a built Rewards page behind a parked tab, mobile must have that page). gluestack-ui v5 needs NativeWind v5 — deferred while this package stays on NativeWind 4.
- **pnpm hoisted linker via `pnpm-workspace.yaml`** (`nodeLinker: hoisted`). pnpm 11 IGNORES `node-linker` in `.npmrc` — without hoisting, Metro can't resolve `react-native-css-interop` and the bundle fails. This is also why the monorepo deliberately has **no root pnpm workspace** — this package must stay its own install root.
- `app.config.ts` (not static `app.json`): `web.output` must stay `"single"`; `userInterfaceStyle` stays `"light"`, which requires `darkMode: 'class'` in tailwind.config.js (NativeWind throws "Cannot manually set color scheme" otherwise).
- Auth = **phone OTP only** (`signInWithOtp` → `verifyOtp` → EF `consumer-web-signin-phone`). The guest flow was REMOVED from the product (PR #530, MESITA-395) — do not re-add it here.
- Session storage = `LargeSecureStore` ([src/lib/storage.ts](src/lib/storage.ts)): AES in AsyncStorage, key in SecureStore (SecureStore has a ~2KB cap; a plain SecureStore adapter silently breaks sessions).
- Env: `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (same publishable-key naming as web). Optional `EXPO_PUBLIC_GMP_KEY` (Maps) + `EXPO_PUBLIC_SENTRY_DSN` (crashes). Public values only; never a service key. EAS project `@canzeco/mesita-mobile-consumer` — secrets live in EAS env, not git.
- **No payment UI, Stripe calls, or subscribe links in this app** (Apple review posture) — Premium renders status only; subscribing happens on the web.
- Bundle ID `com.mesita.consumer` is STAGED, not blessed — no App Store / TestFlight submit until Pato confirms Apple Developer + the ID. EAS **builds** may still run once Apple creds are linked.
- Maps: react-native-maps with **Google provider on both platforms** (`SearchMap.native.tsx`). Web export uses the placeholder in `SearchMap.tsx`. Missing `EXPO_PUBLIC_GMP_KEY` → placeholder; suggest/rail/add still work via EFs.
- EAS: `eas.json` profiles `development` (dev client, channel `development`) + `production` (channel `production`, autoIncrement). OTA via `expo-updates`.
- Sentry: `@sentry/react-native` — init only when `EXPO_PUBLIC_SENTRY_DSN` is set (`src/lib/sentry.ts`).

## Structure
- `src/app/` — Expo Router: `index.tsx` (auth gate) · `sign-in` · `onboard` · `(tabs)/{home,search,rewards,reservations,me}` (mirrors web BottomNav). Rewards is live (QR passport + tickets + ticket detail, MESITA-566; no Stripe subscribe UI). Reservations stays parked "coming soon" (web MESITA-383).
- `src/lib/` — `supabase.ts` (client) · `storage.ts` · `ef.ts` · `api/` (EF helpers, mirror `apps/web-consumer/src/lib/api/*`).
- `src/providers/auth.tsx` — session + profile + `onboarded` predicate (`first_name && last_name && birthday && sex`, same as the web shell layout). Both name halves are required because reservations are booked with the venue under the guest's full name.
- Home hub modes: **Swipe** · **Favorites** live; **Memo** · **Social** parked with Soon pills (web HomeModeNav parity, MESITA-383/565). Ask AI + Social code remains in tree for one-flag unpark.
- Place detail: `src/app/place/[id].tsx` via `consumer-web-get-place` (MESITA-435). Me tab = modular boxes + device prefs in AsyncStorage; Premium = **status only** (no subscribe/payment UI).
- Brand mark: `src/components/brand/MesitaMark.tsx` (Home tab icon). App icons/splash sourced from monorepo `assets/brand` (MESITA-436).
- Search: catalog rail + `consumer-web-suggest-places` + add-place sheet (MESITA-434). Map pins need `EXPO_PUBLIC_GMP_KEY`.
