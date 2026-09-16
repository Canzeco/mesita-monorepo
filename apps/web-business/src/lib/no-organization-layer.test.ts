// MESITA-1892 — the organization layer does not come back to the console.
//
// This app is where the layer LIVED: a route tree under `/orgs/<id>`, a cookie
// naming the active organization, a switcher, a Create ceremony, and a members
// surface beside the place's own. All of it is gone, and the acceptance
// criterion for that is a NEGATIVE — the kind of thing that is true the day it
// ships and quietly false three months later, because nothing fails when
// someone adds the word back.
//
// `supabase/functions/_shared/no-organization-layer.test.ts` is the same guard
// on the other side of the wire. This is the console's half.
//
// TWO THINGS ARE DELIBERATELY ALLOWED, and both are named rather than waved at:
//
//   next.config.ts — the `/orgs/:orgId/...` redirect table. Those addresses
//   were live for months; Stripe stores return links for a year, and browsers
//   keep bookmarks longer. The rules MUST name the dead addresses to forward
//   them, so this scan cannot read that file. `legacy-redirects.test.ts` is
//   what checks it, and it checks the thing that actually matters there: that
//   no rule shadows a LIVE address (MESITA-1839 took a page down for a day
//   doing exactly that, while CI stayed green).
//
//   negative assertions — `expect(...).not.toContain("organization")` has to
//   write the word down to forbid it. A ratchet is not a straggler, so a line
//   that already reads as a refusal is allowed to say it.
//
//   assertions ON the redirect table — `expect(config).toContain('source:
//   "/orgs/:orgId/payments"')` is a test PINNING a forward that must keep
//   existing. It names a dead address for the same reason next.config.ts does,
//   and it is the thing that stops the forward being deleted by accident.
//
// PROSE IS ALLOWED EVERYWHERE. Half the docblocks in this app now explain that
// a fact used to hang off the organization, which is the reason the current
// shape looks the way it does. The scan strips comments and reads code.

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const SRC = join(process.cwd(), "src");

/** The layer, as the tokens a straggler would actually be written with. */
const FORBIDDEN = [
  "organizations",
  "organization_id",
  "organizationId",
  "organization_members",
  "organization_payment_accounts",
  "orgId",
  "org_id",
  "OrgScope",
  "org_plans",
  "requireOrgRole",
  "orgPartnered",
  "orgMesitaPay",
] as const;

/** This file names every dead token on purpose. */
const SELF = "no-organization-layer.test.ts";

function codeOnly(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^[ \t]*\/\/.*$/gm, " ")
    .replace(/([^:])\/\/.*$/gm, "$1 ");
}

/** A line that FORBIDS the word is not a line that uses it. */
function isNegativeAssertion(line: string): boolean {
  return /\.not\.(toContain|toMatch|toHaveTextContent)\(/.test(line) ||
    /expect\([^)]*\)\.not\b/.test(line) ||
    /assert\(\s*!/.test(line);
}

/** A line that PINS a legacy redirect is naming a dead address on purpose —
 *  the same reason next.config.ts is exempt. It must quote the rule to assert
 *  it, and deleting the assertion is how the forward goes missing. */
function pinsALegacyRedirect(line: string): boolean {
  return /source:\s*["'`]\/orgs\//.test(line);
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      out.push(...walk(p));
    } else if (p.endsWith(".ts") || p.endsWith(".tsx")) {
      out.push(p);
    }
  }
  return out;
}

describe("the organization layer is gone from the console", () => {
  it("no source file carries an organization token in code", () => {
    const offenders: string[] = [];

    for (const path of walk(SRC)) {
      if (path.endsWith(SELF)) continue;
      const rel = path.slice(SRC.length + 1);
      const lines = codeOnly(readFileSync(path, "utf8")).split("\n");

      lines.forEach((line, i) => {
        if (isNegativeAssertion(line) || pinsALegacyRedirect(line)) return;
        for (const token of FORBIDDEN) {
          if (new RegExp(`\\b${token}\\b`).test(line)) {
            offenders.push(`${rel}:${i + 1} -> ${token}`);
          }
        }
      });
    }

    expect(
      offenders,
      `The organization layer was removed by MESITA-1892. These still carry it:\n  ${
        offenders.join("\n  ")
      }\n\nThe place is the tenant: the address is /places/<id>/…, membership is place_members,\nthe legal person and the Partner bit are columns on places, and the merchant account is\nplace_payment_accounts. The /orgs/ redirect table in next.config.ts is deliberate and is\nnot scanned — legacy-redirects.test.ts checks that one.`,
    ).toEqual([]);
  });

  it("the scan reads code, spares prose, and spares a refusal", () => {
    // Three-sided, because a codeOnly() or isNegativeAssertion() regression
    // would silently turn the test above into one that asserts nothing.
    const prose = `// It used to hang off the organization (organizationId).\nconst a = 1;`;
    expect(/\borganizationId\b/.test(codeOnly(prose))).toBe(false);

    const real = `const x = row.organizationId;`;
    expect(/\borganizationId\b/.test(codeOnly(real))).toBe(true);

    expect(isNegativeAssertion(`expect(row.detail).not.toContain("organization");`))
      .toBe(true);
    expect(isNegativeAssertion(`const orgId = place.organizationId;`)).toBe(false);

    expect(pinsALegacyRedirect(`expect(config).toContain('source: "/orgs/:orgId/credits"');`))
      .toBe(true);
    expect(pinsALegacyRedirect(`const orgId = params.orgId;`)).toBe(false);
  });

  it("no route file lives under an orgs segment", () => {
    const appDir = join(SRC, "app");
    const orgRoutes = walk(appDir).filter((p) => /[/\\]orgs[/\\]/.test(p));
    expect(
      orgRoutes,
      `these route files still live under /orgs: ${orgRoutes.join(", ")}`,
    ).toEqual([]);
  });
});
