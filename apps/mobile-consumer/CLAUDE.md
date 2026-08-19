# apps/mobile-consumer — native consumer app

> Monorepo-wide rules: root [`CLAUDE.md`](../../CLAUDE.md) (the quickstart) — read it first. This file adds only package-specific rules.

Expo SDK 57 · React Native · Expo Router · NativeWind — the mobile port of `apps/web-consumer`.

**Parity is the standing rule.** IA, screens, visual language, tokens, brand moments and shipped features all match `apps/web-consumer`, including parked-vs-live: whatever web parks, mobile parks, and vice versa. **So [`apps/web-consumer/CLAUDE.md`](../web-consumer/CLAUDE.md) is this package's product law too — read it, and do not restate it here.** This file carries only what genuinely differs on native.

## ALWAYS
- Clients call **Edge Functions only**, never the DB. [src/lib/ef.ts](src/lib/ef.ts) is ported verbatim from `apps/web-consumer/src/lib/api/_invoke.ts`; when one changes, update the other **in the same PR**.
- **Light theme only.** Tokens in [tailwind.config.js](tailwind.config.js) + [src/constants/brand.ts](src/constants/brand.ts) are copied VALUES from web's `globals.css` — web is Tailwind v4 CSS-first, this package is NativeWind 4 + Tailwind 3.4, so they cannot share config. Re-copy in the same PR when web tokens change, EXCEPT the `BRAND-TOKENS` blocks and `src/components/brand/*`, which are **generated** from `assets/brand/brand.json`.
- **Verify via the web build** — `npx expo start --web`, launch config `mobile-consumer` (port 8081). No simulators or devices in agent sessions; real-device verification is EAS/TestFlight and human. Gate every PR on `pnpm typecheck` · `pnpm lint` · `npx expo export --platform web` (the export catches Metro/NativeWind breaks tsc cannot see). CI: `mobile-consumer.yml`.

## Hard constraints — do not re-litigate
- Default kit = NativeWind semantic classes + targeted `@rn-primitives` (Portal/Switch/Slot); shared primitives in `src/components/ui/`. Icons **lucide-react-native only**. **`react-native-paper` is retired** — never re-add the dep or `PaperProvider`. gluestack-ui v5 needs NativeWind v5, deferred.
- **No Stripe, payment UI or subscribe links in this app** (Apple review). Premium renders status only; subscribing happens on web. This is the one deliberate break from web parity.
- **pnpm hoisted linker via `pnpm-workspace.yaml`** (`nodeLinker: hoisted`). pnpm 11 ignores `node-linker` in `.npmrc`; without hoisting Metro cannot resolve `react-native-css-interop` and the bundle fails. This is why the monorepo has no root pnpm workspace.
- `app.config.ts`, not a static `app.json`: `web.output` stays `"single"` and `userInterfaceStyle` stays `"light"`, which requires `darkMode: 'class'` in tailwind.config.js.
- Auth = **phone OTP only** (`signInWithOtp` → `verifyOtp` → EF `consumer-web-signin-phone`). The guest flow was removed from the product — do not re-add it. Session storage = `LargeSecureStore` ([src/lib/storage.ts](src/lib/storage.ts)): AES in AsyncStorage, key in SecureStore, which has a ~2KB cap — a plain SecureStore adapter silently breaks sessions.
- Env: `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; optional `EXPO_PUBLIC_GMP_KEY` and `EXPO_PUBLIC_SENTRY_DSN`. Public values only, never a service key. EAS project `@canzeco/mesita-mobile-consumer`; secrets live in EAS env. Bundle ID `com.mesita.consumer` is **STAGED** — no store submission until Pato confirms it.

## Where native diverges from web
- `src/app/` — Expo Router: `index.tsx` (auth gate) · `sign-in` · `onboard` · `(tabs)/{home,search,rewards,inbox,me}`. Web's third-tab rename applies here too: the label is **Pay**, the route stays `(tabs)/rewards`.
- **Inbox renders its four sections as `SegmentNav` segments of ONE screen**, where web uses nested routes. Same sections, same load-bearing order. `/inbox/*` and `/saved/reservations` redirect to the tab. `ReservationItem.reservedAt` exists in the mobile mirror because `when` is a display string and cannot be sorted on.
- **`SegmentNav` scrolls horizontally as its RESTING state.** A 375px phone genuinely cannot hold five icon+label pills, so unlike web this is not just the large-text fallback. Never fix it by shrinking type below 12px — shorten a label instead.
- Home-hub parked tabs are `ComingSoonModal`, not redirects. `CatalogTab`/`AskAiTab`/`SocialTab` stay in tree — each is a one-flag un-park; never delete them as "unused".
- Maps: react-native-maps with the Google provider on both platforms (`SearchMap.native.tsx`); the web export uses the placeholder. Missing `EXPO_PUBLIC_GMP_KEY` → placeholder, and suggest/rail/add still work via EFs.
- **The wallet + THE TICKET are at v4 parity (MESITA-1094):** searchbar over the bare place list → one-tap create at `base` → the seven-step journey at `/rewards/ticket/[id]`. `lib/ticket-journey.ts` is a BYTE-IDENTICAL copy of web's, pinned by web's `ticket-journey-drift.test.ts` — edit web's, then re-copy; never let them diverge.
- `src/lib/api/` mirrors `apps/web-consumer/src/lib/api/*`. `src/providers/auth.tsx` holds session + profile + the `onboarded` predicate (`first_name && last_name && birthday && sex`) — both name halves are required because reservations are booked under the guest's full name.
