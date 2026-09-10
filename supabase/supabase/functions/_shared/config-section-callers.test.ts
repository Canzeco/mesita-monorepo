// _shared/config-section-callers.test.ts
//
// The section key is a WIRE contract between this package and
// apps/web-admin, and nothing type-checks across that boundary: `shared/`
// mirrors modules BETWEEN the web apps, never into supabase, and each Vercel
// project builds from its own Root Directory. So a renamed registry key, or a
// console posting `section: "filters"` because the page is called
// filters-config, compiles green on both sides and fails at runtime with a 400
// no test ever saw.
//
// This is the substitute: a STRING SCAN of the console's source, in both
// directions. Same idiom as ef-caller-acl.test.ts (which scans for EF names as
// quoted literals), narrowed to the one syntax every call site uses —
// `section: "<key>"` inside the efInvoke body object.
//
// It is deliberately not a call-graph analysis. A key that is only ever built
// at runtime (`section: page.slug`) would read as unreachable here, and that is
// the right answer: this contract is only checkable if the key is written down.

import { assertEquals } from "jsr:@std/assert@1";
import { CONFIG_SECTION_KEYS } from "./config-sections.ts";

const REPO_ROOT = new URL("../../../../", import.meta.url);
const ADMIN_SRC = new URL("apps/web-admin/src/", REPO_ROOT);

/**
 * Deno.readDir is LAZY: on a missing directory it throws NotFound at the FIRST
 * iteration, not at the call, so the tempting
 * `try { d = Deno.readDir(p) } catch { return }` guard catches nothing and the
 * throw surfaces later from inside the for-await, attributed to the wrong line
 * — or, worse, is swallowed and the scan silently reports an empty tree, which
 * for a both-directions test like this one would pass half of it for free.
 * Stat explicitly instead.
 */
async function readDirEntries(dir: URL): Promise<Deno.DirEntry[]> {
  let info: Deno.FileInfo;
  try {
    info = await Deno.stat(dir);
  } catch (err) {
    throw new Error(
      `cannot scan ${dir.pathname}: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
  if (!info.isDirectory) throw new Error(`not a directory: ${dir.pathname}`);
  const entries: Deno.DirEntry[] = [];
  for await (const entry of Deno.readDir(dir)) entries.push(entry);
  return entries;
}

async function sourceFiles(dir: URL): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readDirEntries(dir)) {
    const child = new URL(entry.isDirectory ? `${entry.name}/` : entry.name, dir);
    if (entry.isDirectory) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      out.push(...await sourceFiles(child));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      out.push(await Deno.readTextFile(child));
    }
  }
  return out;
}

/** `section: "<key>"`, in a single/double/backtick quote — the efInvoke body. */
const SECTION_LITERAL = /\bsection:\s*["'`]([A-Za-z0-9_-]+)["'`]/g;

async function sectionsTheConsoleSends(): Promise<string[]> {
  const keys = new Set<string>();
  for (const text of await sourceFiles(ADMIN_SRC)) {
    for (const m of text.matchAll(SECTION_LITERAL)) keys.add(m[1]);
  }
  return [...keys].sort();
}

Deno.test("every section the admin console sends exists in the registry", async () => {
  const sent = await sectionsTheConsoleSends();
  const known = new Set(CONFIG_SECTION_KEYS);
  const strangers = sent.filter((k) => !known.has(k));
  assertEquals(
    strangers,
    [],
    `apps/web-admin posts section(s) admin-web-update-config would 400: ${
      strangers.join(", ")
    }. Either the console has the key wrong or the registry in ` +
      `_shared/config-sections.ts was renamed without its caller.`,
  );
});

Deno.test("every registry section is reachable from the admin console", async () => {
  const sent = new Set(await sectionsTheConsoleSends());
  const unreachable = CONFIG_SECTION_KEYS.filter((k) => !sent.has(k));
  assertEquals(
    unreachable,
    [],
    `${unreachable.length} config section(s) no page in apps/web-admin names: ${
      unreachable.join(", ")
    }. A section nothing calls is dead policy the deploy still ships — delete ` +
      `it, or wire the page that was supposed to reach it.`,
  );
});

Deno.test("the console names both dispatchers and no per-page config EF", async () => {
  const files = await sourceFiles(ADMIN_SRC);
  for (const ef of ["admin-web-get-config", "admin-web-update-config"]) {
    const pattern = new RegExp(`["'\`]${ef}["'\`]`);
    assertEquals(
      files.some((t) => pattern.test(t)),
      true,
      `no call site in apps/web-admin invokes ${ef}`,
    );
  }
  // The twenty collapsed into those two (MESITA-1724). A leftover literal here
  // is a page still calling a slug that has no folder and will 404 the moment
  // the rollback window closes.
  const retired = /["'`]admin-web-(get|update)-[a-z]+-config["'`]/;
  const strays = files.filter((t) => retired.test(t)).length;
  assertEquals(
    strays,
    0,
    `${strays} file(s) in apps/web-admin still invoke a per-page config EF — ` +
      `they are sections of admin-web-get-config / admin-web-update-config now.`,
  );
});
