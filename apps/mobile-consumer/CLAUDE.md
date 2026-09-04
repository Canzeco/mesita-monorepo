# apps/mobile-consumer — native consumer app

> Read root [`CLAUDE.md`](../../CLAUDE.md) first — the quickstart; Notion holds the deep docs. Package-specific rules only below.

Expo SDK 57 · React Native · Expo Router · NativeWind — the mobile port of `apps/web-consumer`.

## FROZEN — do not change this package (Pato, 2026-08-20)
**No features, no fixes, no redesigns here.** Web-consumer is where the product is still being decided; mobile gets rebuilt by COPYING web once web is done, so anything shipped here first is work that copy overwrites. A task landing in this package stops and says so.

**The only writes allowed are the three mirrors web's own tests pin** — they exist to keep WEB green, not to advance mobile: `src/lib/ticket-journey.ts` (byte-identical) · `src/lib/consumer-route-contract.ts` · `src/lib/api/tickets.ts` (`ACTIVE_TICKET_STATUSES`). Re-copy those in the same PR as the web change that moved them. Everything else web changes — tokens, `ef.ts`, screens — waits for the copy pass.

**Parity is the target of that copy pass**, not of every PR: IA, screens, visual language, tokens and parked-vs-live all end up matching `apps/web-consumer`, whose **[`CLAUDE.md`](../web-consumer/CLAUDE.md) is this package's product law** — read it, never restate it. The rest of this file is the package as it stands.

## ALWAYS
- Clients call **Edge Functions only**, never the DB. [src/lib/ef.ts](src/lib/ef.ts) is ported verbatim from `apps/web-consumer/src/lib/api/_invoke.ts`.
- **Light theme only.** Tokens in [tailwind.config.js](tailwind.config.js) + [src/constants/brand.ts](src/constants/brand.ts) are copied VALUES from web's `globals.css` — web is Tailwind v4 CSS-first, this package is NativeWind 4 + Tailwind 3.4, so they cannot share config. The `BRAND-TOKENS` blocks and `src/components/brand/*` are **generated** from `assets/brand/brand.json`.
- **Verify via the web build** — `npx expo start --web`, launch config `mobile-consumer` (port 8081). No simulators in agent sessions; real-device checks are EAS/TestFlight and human. Gate every PR on `pnpm typecheck` · `pnpm lint` · `npx expo export --platform web` (the export catches Metro/NativeWind breaks tsc cannot). CI: `mobile-consumer.yml`.

## Hard constraints — do not re-litigate
- Default kit = NativeWind semantic classes + targeted `@rn-primitives` (Portal/Switch/Slot); shared primitives in `src/components/ui/`. Icons **lucide-react-native only**. **`react-native-paper` is retired** — never re-add it. gluestack-ui v5 needs NativeWind v5, deferred.
- **No Stripe, payment UI or subscribe links** (Apple review). Premium renders status only; subscribing happens on web — the one deliberate break from parity.
- **pnpm hoisted linker via `pnpm-workspace.yaml`** (`nodeLinker: hoisted`). pnpm 11 ignores `node-linker` in `.npmrc`; without hoisting Metro cannot resolve `react-native-css-interop` and the bundle fails. This is why the monorepo has no root pnpm workspace.
- `app.config.ts`, never a static `app.json`: `web.output` stays `"single"`, `userInterfaceStyle` stays `"light"` (which requires `darkMode: 'class'`).
- Auth = **phone OTP only** (`signInWithOtp` → `verifyOtp` → EF `consumer-web-signin-phone`); the guest flow is gone from the product, never re-add it. Session storage = `LargeSecureStore` ([src/lib/storage.ts](src/lib/storage.ts)): AES in AsyncStorage, key in SecureStore, whose ~2KB cap makes a plain adapter break sessions silently.
- Env: `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, optional `EXPO_PUBLIC_GMP_KEY`/`EXPO_PUBLIC_SENTRY_DSN` — public values only, never a service key. EAS project `@canzeco/mesita-mobile-consumer`, secrets in EAS env. Bundle ID `com.mesita.consumer` is **STAGED** — no store submission until Pato confirms.

## Where native diverges from web
- `src/app/` — Expo Router: `index.tsx` (auth gate) · `sign-in` · `onboard` · `(tabs)/{home,search,rewards,inbox,me}` — **five tabs** vs web's four. **Pay** label applies; route stays `(tabs)/rewards`.
- **Activity (`/inbox`) renders four sections as `SegmentNav` segments of ONE screen** (web nests routes instead) — same sections, **order now differs**: web leads with Alerts, mobile doesn't. `/inbox/*` and `/saved/reservations` redirect to the tab. `ReservationItem.reservedAt` exists here because `when` is a display string and cannot be sorted on.
- **`SegmentNav` scrolls horizontally as its RESTING state** — a 375px phone cannot hold five icon+label pills, so unlike web this is not just the large-text fallback. Never shrink type below 12px to fix it; shorten a label.
- Home-hub parked tabs are `ComingSoonModal`, not redirects; `CatalogTab`/`AskAiTab`/`SocialTab` stay in tree, each a one-flag un-park.
- Maps: react-native-maps, Google provider on both platforms (`SearchMap.native.tsx`); the web export and a missing `EXPO_PUBLIC_GMP_KEY` both fall back to the placeholder, and suggest/rail/add still work via EFs.
- **The wallet + THE TICKET are at v4 parity (MESITA-1094):** searchbar over the bare place list → one-tap create at `base` → the seven-step journey at `/rewards/ticket/[id]`.
- `src/lib/api/` mirrors `apps/web-consumer/src/lib/api/*`. `src/providers/auth.tsx` holds session + profile + the `onboarded` predicate (`first_name && last_name && birthday && sex`) — both halves required, because reservations book under the full name.
