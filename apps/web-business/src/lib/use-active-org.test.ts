// MESITA-1710. Chrome asks "which organization?" three times — the rail's
// switcher, the header's breadcrumb, and the mobile wordmark's href — and the
// first version of the rail answered it three different ways. The header was
// handed a server-resolved `organizations[0]` and rendered it for the life of
// the session, so a multi-org operator saw one name in the switcher and a
// DIFFERENT name in the line whose only job is to say whose data is on screen.
//
// These rules pin the answer, and pin that there is only one of it.
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveChromeOrg } from "./use-active-org";

const SRC = path.resolve(__dirname, "..");
const org = (id: string) => ({ id, name: id.toUpperCase() });

describe("resolveChromeOrg mirrors the server's rule", () => {
  const orgs = [org("a"), org("b")];

  it("honours ?org= when you belong to it", () => {
    expect(resolveChromeOrg(orgs, "b")?.id).toBe("b");
  });

  it("falls back to the first when ?org= is absent", () => {
    expect(resolveChromeOrg(orgs, null)?.id).toBe("a");
  });

  it("falls back rather than erroring on a foreign or stale id", () => {
    // Never leak whether an id exists: an org you are not in must resolve
    // exactly like one that does not exist, or the fallback is a membership
    // oracle for anyone who can edit the query string.
    expect(resolveChromeOrg(orgs, "someone-elses-org")?.id).toBe("a");
    expect(resolveChromeOrg(orgs, "")?.id).toBe("a");
  });

  it("is null when you belong to none", () => {
    expect(resolveChromeOrg([], "a")).toBeNull();
    expect(resolveChromeOrg([], null)).toBeNull();
  });
});

describe("one resolver, and every chrome file uses it", () => {
  function walk(dir: string): string[] {
    return readdirSync(dir).flatMap((n) => {
      const full = path.join(dir, n);
      return statSync(full).isDirectory() ? walk(full) : [full];
    });
  }

  it("no chrome component re-derives the active org by hand", () => {
    // The exact shape that drifted: reading the param and picking a fallback
    // inline. If a file needs the active org it imports the hook.
    const offenders: string[] = [];
    for (const file of walk(path.join(SRC, "components", "console"))) {
      if (!/\.tsx$/.test(file) || /\.test\./.test(file)) continue;
      const src = readFileSync(file, "utf8");
      if (!/searchParams\.get\(["']org["']\)/.test(src)) continue;
      offenders.push(path.basename(file));
    }
    expect(offenders).toEqual([]);
  });

  it("the header resolves the org itself, never a pre-resolved name", () => {
    // A server layout cannot read searchParams, so any `orgName` prop it could
    // pass is `organizations[0]` frozen at render.
    const hdr = readFileSync(
      path.join(SRC, "components", "console", "ConsoleHeader.tsx"),
      "utf8",
    );
    expect(hdr).toContain("useActiveOrg(organizations)");
    expect(hdr).not.toMatch(/orgName\s*[,:}]\s*\}\s*:/);
  });
});
