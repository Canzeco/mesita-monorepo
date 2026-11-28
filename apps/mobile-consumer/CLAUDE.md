# apps/mobile-consumer — the guest app for iPhone and Android

> Read root [`CLAUDE.md`](../../CLAUDE.md) first. Package law only; the architecture is Notion Docs › Apps › A2.

- **Layers:** `app → features → components · theme · lib · generated`. A route reads its params and renders one screen. A feature imports only features above it in `FEATURES` (`lint/layers.mjs`), through their `index.ts`, which never exports screens. No `eslint-disable`; a rule changes with its fixture in `lint/fixture/`.
- **Tokens:** a color or a font size is written only in `src/theme.ts`.
- **Generated:** `src/generated/` comes from `deno task sync-shared` and `sync-brand`. Never re-type a rule that exists there or in their sources.
- **Edge Functions:** `consumer-web-*` only. Never the database. Amounts are the server's.
- **Commands:** the `package.json` scripts; `pnpm check` is CI. Add a package with `pnpm exec expo install`. An `eas` command carries `--non-interactive --json`. An SDK upgrade is its own issue.
- **Expo first:** read the docs of the SDK in `package.json` before using an API.
- **Never:** a web target, Expo Go, `ios/` or `android/` in git, a file copied from `apps/web-consumer`, a secret in the bundle.
- **Looks:** every screen copies its web source; the bottom bar and headers are drawn, never the system's (MESITA-5102). Kept system pieces: Docs › Apps › A2.
