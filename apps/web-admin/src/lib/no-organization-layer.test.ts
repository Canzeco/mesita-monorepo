// MESITA-1892 — the organization layer does not come back to this app.
//
// The layer LIVED in web-business, and that app has the long version of this
// guard (with the /orgs redirect table carved out). This app only ever READ
// the layer, so the rule here is simply: none of its names, anywhere in code.
//
// It is worth a file despite being three lines of logic, because what this app
// read was the part that is easiest to put back by accident — a tenant id
// threaded through a payload. The acceptance criterion is a NEGATIVE, and a
// negative with no test is true on the day it ships and quietly false later.
//
// PROSE IS ALLOWED. Several docblocks now explain that a fact used to hang off
// the organization, which is the reason the current shape looks the way it
// does. The scan strips comments and reads code. So is a line that already
// reads as a REFUSAL: a ratchet has to write the word down to forbid it.

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const SRC = join(process.cwd(), "src");
const SELF = "no-organization-layer.test.ts";

const FORBIDDEN = [
  "organizations",
  "organization_id",
  "organizationId",
  "organizationName",
  "orgId",
  "org_id",
  "org_plans",
] as const;

function codeOnly(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^[ \t]*\/\/.*$/gm, " ")
    .replace(/([^:])\/\/.*$/gm, "$1 ");
}

function isNegativeAssertion(line: string): boolean {
  return /\.not\.(toContain|toMatch|toHaveTextContent)\(/.test(line) ||
    /expect\([^)]*\)\.not\b/.test(line);
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (p.endsWith(".ts") || p.endsWith(".tsx")) out.push(p);
  }
  return out;
}

describe("the organization layer is gone from this app", () => {
  it("no source file carries an organization token in code", () => {
    const offenders: string[] = [];
    for (const path of walk(SRC)) {
      if (path.endsWith(SELF)) continue;
      const rel = path.slice(SRC.length + 1);
      codeOnly(readFileSync(path, "utf8")).split("\n").forEach((line, i) => {
        if (isNegativeAssertion(line)) return;
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
      }\n\nThe place is the tenant. A balance, a payment account and a partnership all belong\nto a place; there is nothing above it.`,
    ).toEqual([]);
  });

  it("the scan reads code and spares prose", () => {
    // Without this, a codeOnly() regression would silently turn the test above
    // into one that asserts nothing at all.
    expect(
      /\borganizationId\b/.test(codeOnly(`// it was organizationId once.\nconst a = 1;`)),
    ).toBe(false);
    expect(/\borganizationId\b/.test(codeOnly(`const x = row.organizationId;`))).toBe(true);
  });
});
