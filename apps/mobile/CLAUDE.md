# mesita-mobile-consumer

Native consumer app (Expo SDK 57 · React Native · Expo Router · NativeWind) — the mobile port of `mesita-web-consumer`. Same rules, one Linear ledger (team Mesita, `MESITA-`), same SWARM contract as every Mesita repo: pick → claim (`claimed: <platform>:<session-slug> · branch:agent/<ISSUE-ID>-<slug>`) → isolated checkout → squash PR → merge. Never push to `main`. Full rules: Notion **Rules** page (Development Rules §K for your platform protocol); workspace overview: `../CLAUDE.md`.

## ALWAYS
- Clients call **Edge Functions only** — never the DB. The EF client is [src/lib/ef.ts](src/lib/ef.ts), ported **verbatim** from web `src/lib/api/_invoke.ts`; keep them in sync.
- **Light theme only.** Semantic tokens live in [tailwind.config.js](tailwind.config.js) + [src/constants/brand.ts](src/constants/brand.ts) — copied VALUES from web `globals.css` (web is Tailwind v4 CSS-first, this repo is NativeWind 4 + Tailwind 3.4; they cannot share config). If web tokens change, re-copy here same session.
- Reply in English. Mirror shipped architecture changes to Notion Product Rules same session.
- Premium visual bar: branded gradients (expo-linear-gradient + `GRADIENTS`), tinted icon circles, no wireframe stacks.

## Mobile-specific verification (replaces "verify via Vercel")
- Agents verify via the **web build**: `npx expo start --web` — Claude Preview launch config `mobile` (port 8081) in the workspace `.claude/launch.json`. No simulators/devices in agent sessions.
- Gate every PR on: `pnpm typecheck` · `pnpm lint` · `npx expo export --platform web` (the export catches Metro/NativeWind breaks tsc can't see).
- Real-device verification = EAS builds/TestFlight = human (Pato).

## Hard constraints (learned/decided — do not re-litigate)
- **pnpm hoisted linker via `pnpm-workspace.yaml`** (`nodeLinker: hoisted`). pnpm 11 IGNORES `node-linker` in `.npmrc` — without hoisting, Metro can't resolve `react-native-css-interop` and the bundle fails.
- `app.json`: `web.output` must stay `"single"`; `userInterfaceStyle` stays `"light"`, which requires `darkMode: 'class'` in tailwind.config.js (NativeWind throws "Cannot manually set color scheme" otherwise).
- Auth = **phone OTP only** (`signInWithOtp` → `verifyOtp` → EF `consumer-web-signin-phone`). The guest flow was REMOVED from the product (PR #530, MESITA-395) — do not re-add it here.
- Session storage = `LargeSecureStore` ([src/lib/storage.ts](src/lib/storage.ts)): AES in AsyncStorage, key in SecureStore (SecureStore has a ~2KB cap; a plain SecureStore adapter silently breaks sessions).
- Env: `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (same publishable-key naming as web). Public values only; never a service key.
- **No payment UI, Stripe calls, or subscribe links in this app** (Apple review posture) — Premium renders status only; subscribing happens on the web.
- Bundle ID `com.mesita.consumer` is STAGED, not blessed — no EAS builds / store submissions until Pato confirms it and the Apple Developer account exists (both human-gated).
- Maps (when ported): react-native-maps with **Google provider on both platforms** (Places-derived data must render on Google maps per TOS).

## Structure
- `src/app/` — Expo Router: `index.tsx` (auth gate) · `sign-in` · `onboard` · `(tabs)/{home,search,rewards,reservations,me}` (mirrors web BottomNav; Rewards + Reservations are parked "coming soon", same as web MESITA-383).
- `src/lib/` — `supabase.ts` (client) · `storage.ts` · `ef.ts` · `api/` (EF helpers, mirror web `src/lib/api/*`).
- `src/providers/auth.tsx` — session + profile + `onboarded` predicate (`full_name && birthday && sex`, same as web shell layout).
- Home hub modes (Swipe · Ask AI · Social · Favorites) are tiles awaiting per-screen ports — see the Linear project **Mobile Consumer App** for the roadmap.
