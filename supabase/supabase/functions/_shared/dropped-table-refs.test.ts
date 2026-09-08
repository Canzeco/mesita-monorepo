// MESITA-1602 — no Edge Function may query a table the schema no longer has.
//
// `public.places` was renamed to `place_profiles` by MESITA-1593. The sweep in
// #1557 caught 29 call sites and missed one, because that one did not exist
// when the branch was cut: it arrived on main separately with MESITA-1598's
// `pulseOf` reader while the sweep was in flight. Nothing re-checked the sweep
// at merge time, so `discovery-place.ts` shipped a `.from("places")` against a
// dropped table and every discovery ranking read threw 42P01.
//
// A rename across two PRs is only complete against the commit it was written
// on. This test is the thing that re-checks it at merge time.
//
// WHY A NAME LIST AND NOT A SCHEMA DIFF. The complete version asserts every
// `.from("x")` resolves to a table the replayed migrations actually create,
// which pgTAP is positioned to do since it already replays from scratch. That
// is worth building (MESITA-1602 describes it) but it is not what a live
// outage needs first, and a half-right schema parser that false-positives
// would block the whole fleet. This list is small, exact, and cannot
// misfire.
//
// MESITA-1590 landed: `projects` -> `places` and its six children -> `place_*`.
// `places` came OUT of this list here for exactly the reason the note above
// predicted — it is a real table again, under new ownership — and the seven
// names it just vacated go IN, so this guard keeps catching the MESITA-1602
// failure class against the new names instead of quietly going blind.

import { assertEquals } from "jsr:@std/assert@1";

/** Renamed or dropped, and NOT currently recreated under the same name. */
const DROPPED_TABLES = [
  "projects",
  "project_members",
  "project_invites",
  "project_plans",
  "project_strikes",
  "project_subscriptions",
  "project_verifications",
] as const;

const FUNCTIONS_DIR = new URL("../", import.meta.url).pathname;

function edgeFunctionSources(): string[] {
  const out: string[] = [];
  for (const entry of Deno.readDirSync(FUNCTIONS_DIR)) {
    if (!entry.isDirectory) continue;
    for (
      const file of walk(`${FUNCTIONS_DIR}${entry.name}`)
    ) out.push(file);
  }
  return out;
}

function walk(dir: string): string[] {
  const found: string[] = [];
  for (const e of Deno.readDirSync(dir)) {
    const p = `${dir}/${e.name}`;
    if (e.isDirectory) found.push(...walk(p));
    else if (p.endsWith(".ts")) found.push(p);
  }
  return found;
}

Deno.test("no Edge Function queries a table the schema no longer has", () => {
  const offenders: string[] = [];

  for (const path of edgeFunctionSources()) {
    // This file names the dropped tables on purpose; it is not a caller.
    if (path.endsWith("dropped-table-refs.test.ts")) continue;
    const src = Deno.readTextFileSync(path);
    for (const table of DROPPED_TABLES) {
      // Match the PostgREST call shape only, so prose, comments explaining the
      // rename, and column names that merely contain the word do not trip it.
      if (new RegExp(`\\.from\\(\\s*["'\`]${table}["'\`]\\s*\\)`).test(src)) {
        offenders.push(`${path.replace(FUNCTIONS_DIR, "")} -> .from("${table}")`);
      }
    }
  }

  assertEquals(
    offenders,
    [],
    `These call a dropped table and will throw 42P01 at runtime:\n  ${
      offenders.join("\n  ")
    }\n\nIf a name in DROPPED_TABLES has been recreated, remove it from that list in the same PR.`,
  );
});
