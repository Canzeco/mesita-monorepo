// Which Edge Function doors an OPERATOR can reach (MESITA-1736).
//
// The bug this exists to stop: the Capabilities tab renders for every held
// role but viewer, and every switch on it wrote through the ADMIN
// set-place-rails door — `requireSuperAdmin`. Live DB 2026-09-10: one
// super-admin, one org member, the same person. So the page worked for the
// only account that had ever opened it and 403'd customer #1 on every
// switch, rendered as "Couldn't turn X on. Nothing changed — try again." — a
// retry that could never succeed.
//
// Nothing noticed, because a 403 needs a SECOND ACCOUNT to appear and there
// has never been one. Types, lint, render tests and `ef-caller-acl.test.ts`
// (a flat string scan with the whole set grandfathered) all pass on it. This
// is the check that fails instead.
//
// WHAT IT DOES. Walks the import closure of every route entry under `app/`
// EXCEPT the Admin tab — `places/[id]/admin/page.tsx` refuses a non-super-
// admin outright (`if (!manage.isSuperAdmin) notFound()`), so its subtree is
// the one place `admin-web-*` is correct. In that closure it finds every
// `"admin-web-…"` literal, attributes it to the exported function whose body
// holds it, and keeps the ones some other module in the closure actually
// imports by name. A door nobody imports is not reachable.
//
// A RATCHET: OPERATOR_REACHABLE_ADMIN_DOORS is empty as of MESITA-1740.
// Adding a door fails; a leftover listed name also fails.
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC = path.resolve(__dirname, "..");
const APP = path.join(SRC, "app");
/** Super-admin gated at its own page.tsx — the one subtree where an
 *  `admin-web-*` call is the right call. */
const ADMIN_TAB = path.join(APP, "(shell)/places/[id]/admin");

/** Comments explain WHY a door is what it is and quote the very names this
 *  scans for, so the scan reads code only — same rule as
 *  `business-add-door.test.ts`. */
function codeOnly(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "");
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = path.join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(p) && !/\.test\.tsx?$/.test(p)) out.push(p);
  }
  return out;
}

const EXTENSIONS = ["", ".ts", ".tsx", "/index.ts", "/index.tsx"];
function resolveImport(spec: string, from: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = path.join(SRC, spec.slice(2));
  else if (spec.startsWith(".")) base = path.resolve(path.dirname(from), spec);
  else return null; // a package, not our source
  for (const ext of EXTENSIONS) {
    const p = base + ext;
    if (existsSync(p) && statSync(p).isFile()) return p;
  }
  return null;
}

function importSpecifiers(code: string): string[] {
  const specs: string[] = [];
  const re = /(?:from|import)\s*\(?\s*["']([^"']+)["']\s*\)?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code))) specs.push(m[1]);
  return specs;
}

/** Every name this file imports, whatever module it came from. Coarse on
 *  purpose: a name imported anywhere in the closure counts as reached. */
function importedNames(code: string): string[] {
  const names: string[] = [];
  const re = /import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*["'][^"']+["']/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code))) {
    for (const part of m[1].split(",")) {
      const name = part.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0].trim();
      if (name) names.push(name);
    }
  }
  return names;
}

/** `admin-web-…` literals in this module, keyed by the top-level function
 *  whose body holds them (exported or not) — `null` means module scope. */
function adminDoorsByFunction(code: string): Map<string | null, Set<string>> {
  const out = new Map<string | null, Set<string>>();
  const marks: { name: string; at: number }[] = [];
  const fnRe = /^(?:export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_$]+)/gm;
  let m: RegExpExecArray | null;
  while ((m = fnRe.exec(code))) marks.push({ name: m[1], at: m.index });

  const doorRe = /["'](admin-web-[a-z0-9-]+)["']/g;
  while ((m = doorRe.exec(code))) {
    // The last function that starts before this literal owns it.
    let owner: string | null = null;
    for (const mark of marks) {
      if (mark.at < m.index) owner = mark.name;
      else break;
    }
    if (!out.has(owner)) out.set(owner, new Set());
    out.get(owner)!.add(m[1]);
  }
  return out;
}

/** The exported names of this module, plus — for each PRIVATE top-level
 *  function — the exported functions that call it. `actions.ts` routes four
 *  exports through one private `fetchPlaces`, and attributing its door to
 *  "module scope" would call it reachable when none of the four is imported.
 *  One level of indirection is enough for that shape; anything deeper should
 *  fail LOUD rather than be guessed at, which the module-scope fallback does. */
function callersOfPrivateFunctions(code: string): Map<string, string[]> {
  const decls: { name: string; at: number; exported: boolean }[] = [];
  const fnRe = /^(export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_$]+)/gm;
  let m: RegExpExecArray | null;
  while ((m = fnRe.exec(code))) {
    decls.push({ name: m[2], at: m.index, exported: Boolean(m[1]) });
  }
  const bodyOf = (i: number) => code.slice(decls[i].at, decls[i + 1]?.at ?? code.length);

  const callers = new Map<string, string[]>();
  for (const [i, decl] of decls.entries()) {
    if (decl.exported) continue;
    const found = decls
      .filter((d, j) => d.exported && new RegExp(`\\b${decl.name}\\s*\\(`).test(bodyOf(j)))
      .map((d) => d.name);
    void i;
    callers.set(decl.name, found);
  }
  return callers;
}

function reachableAdminDoors(): Map<string, Set<string>> {
  const entries = walk(APP).filter(
    (f) =>
      /\/(page|layout|template|error|not-found|loading)\.tsx?$/.test(f) &&
      !f.startsWith(ADMIN_TAB),
  );

  const closure = new Set<string>();
  const stack = [...entries];
  while (stack.length) {
    const file = stack.pop()!;
    if (closure.has(file) || file.startsWith(ADMIN_TAB)) continue;
    closure.add(file);
    const code = codeOnly(readFileSync(file, "utf8"));
    for (const spec of importSpecifiers(code)) {
      const dep = resolveImport(spec, file);
      if (dep) stack.push(dep);
    }
  }

  const codeOf = new Map<string, string>();
  for (const f of closure) codeOf.set(f, codeOnly(readFileSync(f, "utf8")));

  const namesUsed = new Set<string>();
  for (const code of codeOf.values()) for (const n of importedNames(code)) namesUsed.add(n);

  const doors = new Map<string, Set<string>>();
  for (const [file, code] of codeOf) {
    const privateCallers = callersOfPrivateFunctions(code);
    for (const [owner, found] of adminDoorsByFunction(code)) {
      // A door inside a function nobody imports is dead weight, not a
      // reachable call. Module scope (owner === null) always counts.
      const reachedBy =
        owner === null
          ? "<module scope>"
          : namesUsed.has(owner)
            ? owner
            : (privateCallers.get(owner) ?? []).find((c) => namesUsed.has(c));
      if (!reachedBy) continue;
      for (const door of found) {
        if (!doors.has(door)) doors.set(door, new Set());
        doors
          .get(door)!
          .add(
            `${owner ?? "<module scope>"}${
              reachedBy === owner || owner === null ? "" : ` (via ${reachedBy})`
            } — ${path.relative(SRC, file)}`,
          );
      }
    }
  }
  return doors;
}

/**
 * The complete set an operator can still reach. Empty as of MESITA-1740:
 * every previously audited door was either wired to a `business-web-*`
 * twin, replaced by a narrow partnership door, or ungated off the
 * operator's screen. Adding one fails; a leftover listed name also fails.
 */
const OPERATOR_REACHABLE_ADMIN_DOORS: Record<string, string> = {};

describe("the operator's console reaches operator doors", () => {
  it("the capability switches write through a door an operator can open", () => {
    // The regression this file is named for. `setPlaceRails` is the only
    // writer of the four acceptance intent bits and the Capabilities tab's
    // whole purpose; if it ever points back at an admin door, every switch
    // 403s for everyone who is not a super-admin.
    const actions = codeOnly(
      readFileSync(path.join(SRC, "components/place-manage/actions.ts"), "utf8"),
    );
    const body = actions.slice(actions.indexOf("export async function setPlaceRails"));
    expect(body).toContain('"business-web-set-place-rails"');
    expect(body.slice(0, body.indexOf("}"))).not.toContain("admin-web-");
  });

  it("reaches no admin-web door outside the audited set", () => {
    const reached = reachableAdminDoors();
    const unaudited = [...reached.keys()]
      .filter((door) => !(door in OPERATOR_REACHABLE_ADMIN_DOORS))
      .sort();
    expect(
      unaudited,
      `New super-admin door(s) reachable from a business role:\n` +
        unaudited
          .map((d) => `  ${d}\n${[...reached.get(d)!].map((s) => `      ${s}`).join("\n")}`)
          .join("\n") +
        `\n\nEither route the caller through a business-web-* door, or stop ` +
        `rendering that surface to a non-super-admin. If it is genuinely new ` +
        `and audited, add it above WITH its verdict.`,
    ).toEqual([]);
  });

  it("shrinks — an audited door that got fixed leaves the list", () => {
    // The other half of a ratchet. Without this the list rots into a set of
    // names nobody has checked in a year, which is what
    // GRANDFATHERED_VIOLATIONS in ef-caller-acl.test.ts became.
    const reached = reachableAdminDoors();
    const stale = Object.keys(OPERATOR_REACHABLE_ADMIN_DOORS)
      .filter((door) => !reached.has(door))
      .sort();
    expect(
      stale,
      `Fixed, but still listed as reachable — delete these entries: ${stale.join(", ")}`,
    ).toEqual([]);
  });

  it("every audited door carries a verdict, not just a name", () => {
    for (const [door, verdict] of Object.entries(OPERATOR_REACHABLE_ADMIN_DOORS)) {
      expect(verdict, `${door} has no verdict`).toMatch(/^(TWIN|UNGATE|NARROW DOOR)/);
      expect(verdict.length, `${door}'s verdict says too little`).toBeGreaterThan(60);
    }
  });
});
