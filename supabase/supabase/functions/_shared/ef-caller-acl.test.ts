// THE EF NAME IS THE ACL (root CLAUDE.md): `actor-web-verb-noun`, exactly
// one caller per endpoint — the app named by `actor`. Nothing enforced that
// until now (MESITA-1600, found because web-business had four live calls
// into `admin-web-*`, correctly gated server-side but silently lying about
// who's allowed to call them). Same failure class as the migration ledger
// (MESITA-1594) and the mobile freeze (MESITA-1599): a convention written
// down as prose that no CI job reads is a convention that will drift.
//
// This scans every `<actor>-web-*` Edge Function name for a literal
// occurrence in each app's source tree and fails when it turns up in an
// app the actor doesn't own. It is a STRING search, not a call-graph
// analysis — cheap, and exactly the shape of drift that bit MESITA-1600
// (the EF name traveled as a literal into a `components/` file).
//
// A RATCHET, not a rewrite: running this cold found 21 existing violations —
// far more than the 4 MESITA-1600 named by hand — spanning a real
// architectural question (should web-business's operator actions route
// through web-admin instead, or do some of these EFs legitimately serve two
// consoles and need renaming?) that is explicitly NOT this test's call to
// make. GRANDFATHERED_VIOLATIONS freezes today's known set: this fails on
// any NEW violation from here, and shrinks as each grandfathered one gets
// fixed — remove its line here in the same PR that fixes it.
//
// OUT OF SCOPE ON PURPOSE: `stripe-*` (Stripe's own webhook delivery, not
// an app), `supabase-*` (internal cron/edgefunc caller), `eleven-*`
// (ElevenLabs' voice-agent tool calls), and the one-off `staff-web-*`
// benchmark EF (invoked by an ops script, not any app in `apps/`) — none
// of these have a caller this scan can verify by reading `apps/`.

const FUNCTIONS_DIR = new URL("../", import.meta.url);
const REPO_ROOT = new URL("../../../../", import.meta.url);

/**
 * Which app directories a given `<actor>-web-*` prefix may be called from.
 */
const ACTOR_APPS: Record<string, readonly string[]> = {
  admin: ["web-admin"],
  business: ["web-business", "mobile-business"],
  consumer: ["web-consumer", "mobile-consumer"],
  validate: ["web-validate"],
  // The public gift-landing page (MESITA-1677) — a stranger with a code, no
  // account, lives as a top-level route in web-consumer (outside its own
  // (shell) auth wall), not a separate app the way web-validate is. Same
  // actor-per-prefix rule, one owner.
  gift: ["web-consumer"],
};

/**
 * `<actor>-web-*` prefixes that are real but NOT app-callable — this scan
 * cannot verify their caller by reading `apps/`, so it deliberately skips
 * them rather than mis-flagging or silently passing. `staff-web-*` is one
 * EF (`staff-web-benchmark-link-strategies`) invoked by an ops script, not
 * a console.
 */
const NON_APP_ACTORS = new Set(["staff"]);

/**
 * Known-as-of-MESITA-1600 violations, frozen so this test is a RATCHET
 * (catches new drift) rather than a blocker on fixing the 21 that already
 * existed the day this test landed. Each is `efName:strayApp`. Fixing one
 * — reroute the caller, or rename the EF if it legitimately serves both
 * consoles — removes its line here in the same PR.
 */
const GRANDFATHERED_VIOLATIONS = new Set([
  "admin-web-decide-verification:web-business",
  "admin-web-enrich-place:web-business",
  "admin-web-find-place:web-business",
  "admin-web-get-atlas-fields:web-business",
  "admin-web-get-place-activity:web-business",
  "admin-web-get-place-enrichment:web-business",
  "admin-web-get-place-payment-account:web-business",
  "admin-web-get-place-verification:web-business",
  "admin-web-list-notifications:web-business",
  "admin-web-list-verifications:web-business",
  "admin-web-reset-database:web-consumer",
  "admin-web-review-ticket-report:web-business",
  "admin-web-search-places:web-business",
  "admin-web-set-place-active:web-business",
  "admin-web-set-place-enrichment:web-business",
  "admin-web-set-place-listed:web-business",
  "admin-web-set-place-verified:web-business",
  "admin-web-set-plan:web-business",
  "admin-web-suggest-places:web-business",
  "consumer-web-create-reservation:web-admin",
]);

async function efActorPrefixes(): Promise<string[]> {
  const names: string[] = [];
  for await (const entry of Deno.readDir(FUNCTIONS_DIR)) {
    if (!entry.isDirectory || entry.name === "_shared") continue;
    const actor = entry.name.split("-")[0];
    if (actor in ACTOR_APPS && entry.name.startsWith(`${actor}-web-`)) {
      names.push(entry.name);
    }
  }
  return names.sort();
}

async function* walkSourceFiles(dir: URL): AsyncGenerator<string> {
  let entries;
  try {
    entries = Deno.readDir(dir);
  } catch {
    return;
  }
  for await (const entry of entries) {
    const child = new URL(
      entry.isDirectory ? `${entry.name}/` : entry.name,
      dir,
    );
    if (entry.isDirectory) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      yield* walkSourceFiles(child);
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      yield await Deno.readTextFile(child);
    }
  }
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Every app under `apps/` that INVOKES `efName` — the name appearing as its
 * own complete quoted string literal (`"efName"` / `'efName'` / a
 * backtick-delimited one), which is how every invoke helper in this repo
 * takes the function name as an argument.
 *
 * Deliberately NOT a bare substring match: this codebase's comments name
 * other functions constantly for context (e.g. "the same backend
 * apps/web-validate calls"), and a descriptive label string can legitimately
 * mention an EF by name mid-sentence inside ITS OWN unrelated string
 * literal ("today: business-web-suggest-promo)."). Only a quote
 * immediately before AND after the name is an argument, not prose.
 */
function appsReferencing(
  efName: string,
  appSources: Map<string, string[]>,
): string[] {
  const pattern = new RegExp(`["'\`]${escapeRegExp(efName)}["'\`]`);
  const hits: string[] = [];
  for (const [app, files] of appSources) {
    if (files.some((text) => pattern.test(text))) hits.push(app);
  }
  return hits;
}

Deno.test("EF-NAME-IS-THE-ACL: an <actor>-web-* function is referenced only from its own app(s)", async () => {
  const efNames = await efActorPrefixes();
  const allApps = [...new Set(Object.values(ACTOR_APPS).flat())];

  // Read every app's source ONCE, not once per EF name — this is a few
  // hundred files total, and each is scanned against every EF name in
  // memory rather than re-read from disk per name.
  const appSources = new Map<string, string[]>();
  for (const app of allApps) {
    const files: string[] = [];
    for await (
      const text of walkSourceFiles(new URL(`apps/${app}/src/`, REPO_ROOT))
    ) {
      files.push(text);
    }
    appSources.set(app, files);
  }

  const newViolations: string[] = [];
  const seenGrandfathered = new Set<string>();
  for (const efName of efNames) {
    const actor = efName.split("-")[0];
    const allowed = new Set(ACTOR_APPS[actor]);
    const referencedBy = appsReferencing(efName, appSources);
    for (const app of referencedBy) {
      if (allowed.has(app)) continue;
      const key = `${efName}:${app}`;
      if (GRANDFATHERED_VIOLATIONS.has(key)) {
        seenGrandfathered.add(key);
        continue;
      }
      newViolations.push(
        `${efName} (actor "${actor}", allowed: ${
          [...allowed].join(", ")
        }) is also referenced from: ${app}`,
      );
    }
  }

  if (newViolations.length > 0) {
    throw new Error(
      `EF-name-is-the-ACL: ${newViolations.length} NEW violation(s) beyond the frozen MESITA-1600 set:\n` +
        newViolations.map((v) => `  - ${v}`).join("\n") +
        "\n\nEither the caller is wrong (route through the owning app's console " +
        "instead) or the EF's actor prefix no longer matches reality and the " +
        'function needs renaming (root CLAUDE.md: "The EF name is the ACL"). ' +
        "If this is an intentional, reviewed exception, add it to " +
        "GRANDFATHERED_VIOLATIONS with a reason — don't let the list grow silently.",
    );
  }

  // The other direction: a grandfathered entry that's no longer reproduced
  // is either fixed (remove the line — this is a passing test either way,
  // so nothing forces the cleanup, but a stale entry hides how close the
  // count really is to zero) or the app's source moved and the scan missed
  // it — worth a human glance either way, so this fails loudly rather than
  // quietly staying green forever.
  const stale = [...GRANDFATHERED_VIOLATIONS].filter((k) =>
    !seenGrandfathered.has(k)
  );
  if (stale.length > 0) {
    throw new Error(
      `GRANDFATHERED_VIOLATIONS lists ${stale.length} entr${
        stale.length === 1 ? "y" : "ies"
      } ` +
        `no longer found — remove from the allowlist if fixed, or re-check the scan:\n` +
        stale.map((v) => `  - ${v}`).join("\n"),
    );
  }
});

Deno.test("ACTOR_APPS covers every actor this repo actually has *-web-* functions for", async () => {
  // A guard on the guard: if a new actor prefix appears (a fifth console),
  // this test must be taught about it explicitly rather than silently
  // skipping every function that new actor owns.
  const seen = new Set<string>();
  for await (const entry of Deno.readDir(FUNCTIONS_DIR)) {
    if (!entry.isDirectory || entry.name === "_shared") continue;
    const match = entry.name.match(/^([a-z]+)-web-/);
    if (match) seen.add(match[1]);
  }
  const known = new Set(Object.keys(ACTOR_APPS));
  const unknown = [...seen].filter((a) =>
    !known.has(a) && !NON_APP_ACTORS.has(a)
  );
  if (unknown.length > 0) {
    throw new Error(
      `New *-web-* actor prefix(es) with no ACTOR_APPS entry: ${
        unknown.join(", ")
      }. ` +
        `Add them to ef-caller-acl.test.ts's ACTOR_APPS (if app-callable) or ` +
        `NON_APP_ACTORS (if not) before this can verify their callers.`,
    );
  }
});
