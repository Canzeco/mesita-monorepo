# apps/web-check — Mesita Check, the staff app (check.mesita.ai)

> Monorepo-wide rules: root [`CLAUDE.md`](../../CLAUDE.md) (the quickstart) — read it first. This file adds only package-specific rules.

- **The staff side of Tickets v2 (MESITA-806/813):** the waiter scans the QR a guest generated in their consumer app and lands on `/check/<code>` — proof the ticket is real, plus the visit's actions (enter the bill, approve story/review, confirm payment). Root page = explainer + hand-typed code fallback.
- **The name is "Check", never "Checkout" (MESITA-815).** `checkout` in this repo means **Stripe** (`stripe.checkout`, `checkout_url`) — the subscription billing flow. `check` is this page's own shipped vocabulary: the `check-web-*` EFs, the `check_code` column, `CHECK_URL_BASE`, and the `check` caller in [`ARCHITECTURE.md`](../../supabase/ARCHITECTURE.md). It also says both jobs at once — *check* = la cuenta, *check* = verify. Don't reintroduce "checkout" here: it implies Mesita processes payments, which the page itself denies.
- **No login by design.** The 128-bit check code in the URL is the whole authentication; the `check-web-*` Edge Functions are `verify_jwt=false`. Deliberately **no supabase-js dependency** — `src/lib/check-api.ts` is plain fetch (public constant URL; `NEXT_PUBLIC_SUPABASE_URL` optional override). Keep it that way.
- **Staff-facing → Spanish (es-MX) copy**, `robots: noindex`, light theme.
- **URL flip pending:** live QRs still encode `mesita.ai/check/<code>` (served by web-landing). Until the Vercel project + `check.mesita.ai` domain exist and the EF `CHECK_URL_BASE` flips, this app and web-landing intentionally both carry the check page — mirror any check-flow change into `apps/web-landing` in the same PR while the duplication window is open (MESITA-814 has the flip plan, including the recommendation to serve codes at the domain root: `check.mesita.ai/<code>`).
- "venue" is prohibited in copy → "place" / "business" (same rule as web-landing).
- CI: `web-check.yml` — lint · typecheck · build (Node 22+), path-filtered to `apps/web-check/**`.
