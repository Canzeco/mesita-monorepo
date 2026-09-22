#!/usr/bin/env -S deno run --allow-read --allow-write
// sync-shared.ts — propagate the modules web-admin and web-business BOTH own
// from ONE canonical source (shared/) into each app.
//
// CONTRACT (MESITA-1614):
//   shared/**            = SOURCE OF TRUTH. Hand-edited.
//   apps/web-*/src/**    = FULLY GENERATED copies, one per target below.
//
// WHY GENERATE INSTEAD OF SHARING A PACKAGE. The monorepo has NO root pnpm
// workspace on purpose (mobile needs nodeLinker: hoisted, the web apps use the
// default isolated linker), so there is no import path every app can reach —
// and each Vercel project builds from its own Root Directory, so a sibling
// directory is not even in the build context. Generation is how this repo
// already keeps CLAUDE.md/AGENTS.md and the whole brand system in lockstep;
// see scripts/sync-rules.ts and scripts/sync-brand.ts. Same idiom, same
// --check gate in CI.
//
// WHAT BELONGS HERE. Modules that are byte-identical in both apps AND are
// POLICY rather than plumbing: a vocabulary, a formatter, a scoring rule, a
// feed shape. They may import per-app adapters through the `@/` alias —
// `supabase-ef.ts` reaches `@/lib/supabase/server`, `manage.tsx` reaches
// `@/components/ErrorNote`, the notification trio reaches a sibling
// `./actions` — and those adapters legitimately DIFFER per app. The shared
// file is the policy; the alias is the seam. That is why a canonical file here
// is not independently type-checkable: each app's own `tsc` is what proves it,
// which is exactly the check that already runs.
//
// WHAT DOES NOT BELONG HERE. Anything sync-brand already generates
// (components/brand/*, brand-data.ts) — two owners for one file is a fight,
// not a guarantee.
//
// HOW TO DIVERGE. Delete the entry from TARGETS. That is a deliberate act with
// a diff and a reviewer, which is the whole point: this script does not stop
// two apps from differing, it stops them from differing BY ACCIDENT.
//
// Run from the repo root:
//     deno task sync-shared
// Pass --check to verify without writing (STRICT: any drift exits 1).
//
// Worktree conflicts on generated files: regenerate, never hand-merge.

import { dirname, fromFileUrl, join } from "@std/path";

const repoRoot = dirname(dirname(fromFileUrl(import.meta.url)));
const check = Deno.args.includes("--check");

const RUN = "deno task sync-shared";

/** One canonical source, and where each app keeps its copy.
 *
 *  The notification trio lands on DIFFERENT paths per app — admin files it
 *  under the Global Performance screen, business under the place's
 *  notifications section — which is precisely why a plain "same path in both"
 *  rule would not have caught it. They were identical and invisible to any
 *  same-path diff. */
// A target names its destinations two ways.
//
//   apps   — keyed by app name, written under `apps/<name>/<rel>`. Twelve
//            entries predate this and every one of them lands in a web app.
//   paths  — full repo-relative destinations, for consumers that are NOT under
//            `apps/`. `supabase/supabase/functions/_shared/` is the reason it
//            exists (MESITA-2038): an Edge Function cannot reach out of the
//            functions root into repo-root `shared/` and survive a deploy
//            bundle, so it takes a generated copy like every other consumer.
//            Before this field the destination was inexpressible, and writing
//            `apps: { "../supabase": … }` would have silently produced
//            `apps/../supabase/…` with `sync-shared:check` still green.
const TARGETS: {
  source: string;
  apps: Record<string, string>;
  paths?: string[];
}[] = [
  {
    source: "state-vocabulary.ts",
    apps: {
      "web-admin": "src/lib/state-vocabulary.ts",
      "web-business": "src/lib/state-vocabulary.ts",
    },
  },
  {
    source: "format.ts",
    apps: {
      "web-admin": "src/lib/format.ts",
      "web-business": "src/lib/format.ts",
    },
  },
  {
    source: "phone-countries.ts",
    apps: {
      "web-admin": "src/lib/phone-countries.ts",
      "web-business": "src/lib/phone-countries.ts",
    },
  },
  {
    source: "supabase-ef.ts",
    apps: {
      "web-admin": "src/lib/supabase-ef.ts",
      "web-business": "src/lib/supabase-ef.ts",
    },
  },
  {
    source: "promotion-score.ts",
    apps: {
      "web-admin": "src/lib/business/promotion-score.ts",
      "web-business": "src/lib/business/promotion-score.ts",
    },
  },
  {
    source: "proxy.ts",
    apps: { "web-admin": "src/proxy.ts", "web-business": "src/proxy.ts" },
  },
  {
    source: "manage.tsx",
    apps: {
      "web-admin": "src/components/admin-ui/manage.tsx",
      "web-business": "src/components/admin-ui/manage.tsx",
    },
  },
  {
    source: "notifications/notification-feed.ts",
    apps: {
      "web-admin": "src/app/(app)/global-performance/notification-feed.ts",
      "web-business":
        "src/components/place-manage/notifications/notification-feed.ts",
    },
  },
  {
    source: "notifications/notification-config.ts",
    apps: {
      "web-admin": "src/app/(app)/global-performance/notification-config.ts",
      "web-business":
        "src/components/place-manage/notifications/notification-config.ts",
    },
  },
  {
    source: "notifications/notification-enricher-phase.ts",
    apps: {
      "web-admin":
        "src/app/(app)/global-performance/notification-enricher-phase.ts",
      "web-business":
        "src/components/place-manage/notifications/notification-enricher-phase.ts",
    },
  },
  // THE FIRST TARGET THAT IS NOT web-admin + web-business (MESITA-2037).
  //
  // The product FAMILIES are policy the two CONSOLES share — mock-business-app
  // and web-business — and web-admin has no product catalogue to paint. Every
  // entry above happens to pair the same two apps, which is a fact about what
  // has been shared so far and never a rule; the writer loops
  // `Object.entries(target.apps)` and has always been generic.
  //
  // WHY THE MOCK IS A TARGET AT ALL. It keeps a hand-snapshot of
  // `product-keys.ts` with no gate under it, and that snapshot is exactly how
  // web-business ended up four product names stale. A hue drifting the same
  // way is worse than a label: the two consoles would be making two different
  // claims about what a product IS, in colour, with every check green.
  {
    source: "product-families.ts",
    apps: {
      "mock-business-app": "src/lib/product-families.ts",
      "web-business": "src/lib/product-families.ts",
    },
  },
  // THE REWARD MODEL, AND THE FIRST TARGET OUTSIDE `apps/` (MESITA-2038).
  //
  // Six consumers, because the lever percentages, the rewardable base and the
  // per-plan ceiling are one fact and every surface that prints money must
  // print the same one. Before this the same numbers lived in SEVEN
  // hand-maintained copies and two of them had already drifted in user-visible
  // copy, with nothing comparing them.
  //
  // `supabase/supabase/functions/_shared/` is here rather than taking a direct
  // Deno import out of the functions root: a reach into repo-root `shared/` is
  // a bundling risk on `supabase functions deploy`, and `sync-shared:check`
  // cannot see an import. A generated copy is the same mechanism every other
  // consumer already uses, and the one gate covers all six.
  //
  // `format.ts` is deliberately NOT extended to the consumer apps or the mock.
  // The mock owns a hand-written `src/lib/format.ts` with six exports the whole
  // app renders through, and it renders `$1,234.00` where this one renders
  // `MX$…`; the collision guard below refuses that write rather than trusting
  // a future reader to notice.
  {
    source: "rewards-model.ts",
    apps: {
      "web-admin": "src/lib/rewards-model.ts",
      "web-business": "src/lib/rewards-model.ts",
      "mock-business-app": "src/lib/rewards-model.ts",
      "web-consumer": "src/lib/rewards-model.ts",
      "mobile-consumer": "src/lib/rewards-model.ts",
    },
    paths: ["supabase/supabase/functions/_shared/rewards-model.ts"],
  },
];

/** The first bytes of every generated copy. One definition, three readers:
 *  `notice()` writes it, the source-purity check refuses a `shared/` file that
 *  carries it, and the collision guard uses it to tell a generated destination
 *  from a hand-written one. */
const GENERATED_PREFIX = "// GENERATED by scripts/sync-shared.ts";

/** The notice every generated copy carries, naming its source so the fix is
 *  obvious from the file you are wrongly editing. */
function notice(source: string): string {
  return [
    `// GENERATED by scripts/sync-shared.ts from shared/${source} — do not`,
    `// hand-edit. Edit the source and run: ${RUN}`,
    "",
  ].join("\n");
}

let drift = 0;
let written = 0;
const missing: string[] = [];

for (const target of TARGETS) {
  const sourcePath = join(repoRoot, "shared", target.source);
  let body: string;
  try {
    body = await Deno.readTextFile(sourcePath);
  } catch {
    missing.push(`shared/${target.source}`);
    continue;
  }
  // A canonical source must never carry the notice itself: it would be copied
  // into the output and the next run would prepend a second one.
  if (body.startsWith(GENERATED_PREFIX)) {
    console.error(
      `sync-shared: shared/${target.source} carries the generated notice — ` +
        `the source is hand-edited and must not.`,
    );
    Deno.exit(1);
  }
  const out = notice(target.source) + body;

  const destinations: string[] = [
    ...Object.entries(target.apps).map(([app, rel]) => `apps/${app}/${rel}`),
    ...(target.paths ?? []),
  ];

  for (const rel of destinations) {
    const dest = join(repoRoot, rel);
    let current: string | null = null;
    try {
      current = await Deno.readTextFile(dest);
    } catch {
      current = null;
    }
    if (current === out) continue;

    // THE COLLISION GUARD. A destination that already exists and does NOT
    // carry the generated notice is a hand-written file somebody owns, and
    // this script writes unconditionally — so without this check, adding one
    // TARGETS line silently destroys it. That is not hypothetical: at
    // MESITA-2038 a proposal to target `format.ts` at the mock console would
    // have overwritten six hand-written exports (`money`, `moneyShort`, `day`,
    // `dayTime`, `since`, `stars`) that the whole app renders through.
    if (current !== null && !current.startsWith(GENERATED_PREFIX)) {
      console.error(
        `sync-shared: REFUSED  ${rel}  exists and is NOT generated — ` +
          `adding it as a target for shared/${target.source} would destroy it. ` +
          `Delete or rename the hand-written file first, or pick another path.`,
      );
      Deno.exit(1);
    }

    if (check) {
      drift++;
      console.error(
        `sync-shared: DRIFT  ${rel}  (source: shared/${target.source})`,
      );
      continue;
    }
    await Deno.mkdir(dirname(dest), { recursive: true });
    await Deno.writeTextFile(dest, out);
    written++;
  }
}

if (missing.length > 0) {
  console.error(`sync-shared: missing source(s): ${missing.join(", ")}`);
  Deno.exit(1);
}

if (check) {
  if (drift > 0) {
    console.error(
      `\nsync-shared: ${drift} generated file(s) drifted. Run \`${RUN}\`.`,
    );
    Deno.exit(1);
  }
  console.log(
    `sync-shared: ${TARGETS.length} sources in sync across every target.`,
  );
} else {
  console.log(
    `sync-shared: ${TARGETS.length} sources, ${written} file(s) written.`,
  );
}
