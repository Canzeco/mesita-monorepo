<!-- GENERATED — scripts/sync-rules.ts mirrors this file from its sibling CLAUDE.md. Edit CLAUDE.md (root: below its END marker) or scripts/rules-quickstart.md — NEVER this file. -->
# apps/web-visit — the staff page (visit.mesita.ai)

> Read root [`CLAUDE.md`](../../CLAUDE.md) first. Package law only.

- No sign-in. `/proof/<token>`: the token is the key (MESITA-3304).
- From `@mesita/place-profile`, plain `lib/*` modules only.
- **Edge Functions:** `visit-web-*` only. Every rule and peso is the server's.
- Light theme, no index by search engines.
