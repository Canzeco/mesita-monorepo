# apps/mobile-business — Mesita Business (native)

> **Status: scaffold only.** A fresh Expo SDK 57 app, wired to EAS and mirroring the
> `mobile-consumer` toolchain. No screens/features are built yet — a single placeholder route.

Native business app (Expo SDK 57 · React Native · Expo Router · NativeWind), sibling to
[`apps/mobile-consumer`](../mobile-consumer). It is a **separate** EAS project
(`@canzeco/mesita-mobile-business`, projectId `aa2fc707-f877-462e-b7a2-76f0d431dbc1`) with its
own bundle id `com.mesita.business` — one EAS project per app.

Toolchain parity with `../mobile-consumer` is intentional (pnpm hoisted linker, NativeWind 4 +
Tailwind 3.4, light theme, `web.output: "single"`). When actually building this app, port
structure/patterns from `mobile-consumer` and re-derive theme tokens from `apps/web-business`.

## Commands
- Install deps: `pnpm install`
- Web verify (Metro/NativeWind sanity, mirrors CI): `npx expo export --platform web`
- Typecheck / lint: `pnpm typecheck` · `pnpm lint`

## Gates (human-only)
EAS builds and store submissions are human-gated: bundle id `com.mesita.business` is **staged, not
blessed** — no builds/submissions until the Apple Developer account and identifiers are confirmed.
