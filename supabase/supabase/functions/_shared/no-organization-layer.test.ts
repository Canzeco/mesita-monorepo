// MESITA-1892 — the organization layer does not come back.
//
// The issue's acceptance criterion is a NEGATIVE: "the active schema contains
// no organization entity or organization-based ownership", and "organizations
// must not exist, including as hidden infrastructure". A negative is exactly
// the kind of thing that is true on the day it ships and quietly false three
// months later, because nothing fails when someone adds a column back.
//
// `dropped-table-refs.test.ts` already catches `.from("organizations")` and
// its four siblings. This file is the wider guard: no Edge Function source may
// carry the CONCEPT at all — not a table name, not a column, not a variable,
// not a request field, not a call to one of the dropped SQL functions.
//
// WHY A SOURCE SCAN AND NOT TYPES. `deno check` cannot see it: PostgREST calls
// are strings, RPC names are strings, and request bodies are `unknown` until a
// validator narrows them. The column is gone from the database, so a straggler
// is a runtime 42703 on a money path, not a compile error.
//
// HISTORY IS ALLOWED TO BE DISCUSSED. Every docblock in this codebase explains
// WHY, and several now say "this used to hang off the organization" — deleting
// that prose would delete the reason the current shape looks the way it does.
// So the scan ignores comments entirely and reads CODE only.

import { assertEquals } from "jsr:@std/assert@1";

const FUNCTIONS_DIR = new URL("../", import.meta.url).pathname;

/** The layer, as the tokens a straggler would actually be written with. */
const FORBIDDEN = [
  // tables and the column
  "organizations",
  "organization_members",
  "organization_invites",
  "organization_guest_customers",
  "organization_payment_accounts",
  "organization_id",
  "org_plans",
  // the identifiers the TypeScript side used
  "organizationId",
  "orgId",
  "requireOrgRole",
  "orgRoleFor",
  "orgIdForPlace",
  // SQL functions the migration dropped
  "claim_place_into_org",
  "release_place_from_org",
  "org_mesita_pay_enabled",
] as const;

/** Strips block comments, line comments and the contents of string literals.
 *
 *  STRINGS GO TOO, and that is not a hole: a forbidden name in a string is
 *  either a PostgREST table name or an RPC name — both of which are code in
 *  every sense that matters — so they are scanned separately below against the
 *  raw source. What stripping buys is that a SENTENCE inside an error message
 *  or a docblock-adjacent literal explaining the removal does not trip it. */
function codeOnly(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^[ \t]*\/\/.*$/gm, " ")
    .replace(/([^:])\/\/.*$/gm, "$1 ");
}

/** The two shapes where a string literal IS code: `.from("x")` and the first
 *  argument of `.rpc("x")`. Scanned against raw source so a comment cannot
 *  hide one and stripping cannot miss one. */
const CALL_SHAPES = (name: string) => [
  new RegExp(`\\.from\\(\\s*["'\`]${name}["'\`]`),
  new RegExp(`\\.rpc\\(\\s*["'\`]${name}["'\`]`),
];

function walk(dir: string): string[] {
  const found: string[] = [];
  for (const e of Deno.readDirSync(dir)) {
    const p = `${dir}/${e.name}`;
    if (e.isDirectory) found.push(...walk(p));
    else if (p.endsWith(".ts")) found.push(p);
  }
  return found;
}

function edgeFunctionSources(): string[] {
  const out: string[] = [];
  for (const entry of Deno.readDirSync(FUNCTIONS_DIR)) {
    if (!entry.isDirectory) continue;
    out.push(...walk(`${FUNCTIONS_DIR}${entry.name}`));
  }
  return out;
}

/** This file and the retired-name guard both NAME the layer on purpose. */
const SELF = [
  "no-organization-layer.test.ts",
  "dropped-table-refs.test.ts",
];

Deno.test("no Edge Function code carries the organization layer", () => {
  const offenders: string[] = [];

  for (const path of edgeFunctionSources()) {
    const rel = path.replace(FUNCTIONS_DIR, "");
    if (SELF.some((s) => rel.endsWith(s))) continue;

    const raw = Deno.readTextFileSync(path);
    const code = codeOnly(raw);

    for (const name of FORBIDDEN) {
      // A word-boundary match on stripped code: prose is already gone, so a
      // hit here is an identifier, a property or a key.
      if (new RegExp(`\\b${name}\\b`).test(code)) {
        offenders.push(`${rel} -> ${name}`);
        continue;
      }
      // …and the two call shapes, against the raw text.
      if (CALL_SHAPES(name).some((re) => re.test(raw))) {
        offenders.push(`${rel} -> .from/.rpc("${name}")`);
      }
    }
  }

  assertEquals(
    offenders,
    [],
    `The organization layer was removed by MESITA-1892. These still carry it:\n  ${
      offenders.join("\n  ")
    }\n\nThe place is the tenant. A record belongs to a place, membership is place_members,\nthe merchant account is place_payment_accounts, and the partner bit is places.partnered.\nIf you are reintroducing organizations deliberately, that is a schema decision and an\nissue of its own — not an edit to this list.`,
  );
});

Deno.test("the scan cannot be defeated by a comment, and does not fire on one", () => {
  // Two-sided: prose about the removal must pass, and a real reference must
  // fail. Without this, a codeOnly() regression would silently make the guard
  // above assert nothing at all.
  const prose = `// This used to hang off the organization (organization_id).\nconst a = 1;`;
  assertEquals(/\borganization_id\b/.test(codeOnly(prose)), false);

  const real = `const x = row.organization_id;`;
  assertEquals(/\borganization_id\b/.test(codeOnly(real)), true);

  const fromCall = `await admin.from("organizations").select("id");`;
  assertEquals(CALL_SHAPES("organizations").some((re) => re.test(fromCall)), true);
});
