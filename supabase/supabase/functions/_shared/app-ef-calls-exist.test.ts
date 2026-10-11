// Every Edge Function an app calls has a folder (MESITA-2090).
//
// ef-caller-acl.test.ts asks "is this app ALLOWED to call that function?" — it
// walks the folders that exist and flags a call from the wrong app. It cannot
// see a call to a function that no longer exists: retiring a folder that an
// app still invokes passes lint, typecheck and every other test, and the
// deploy job's `leftover` step then deletes it from the cloud. That is how
// Testing › Billing → admin-web-check-api-health would have shipped broken.
//
// So: every quoted `<actor>-web-<verb>` string in a surviving app's source must
// name a folder under supabase/supabase/functions. Generated DB types are
// skipped (they are not calls).

import { assertEquals } from "jsr:@std/assert@1";

const FUNCTIONS_DIR = new URL("../", import.meta.url);
const REPO_ROOT = new URL("../../../../", import.meta.url);
const APPS = ["web-admin", "web-consumer", "web-landing"];
const NAME = /["'`]((?:admin|consumer)-web-[a-z0-9-]+)["'`]/g;
const SKIP_DIRS = new Set(["node_modules", ".next", "dist", ".vercel"]);

async function* sourceFiles(dir: URL): AsyncGenerator<URL> {
  let entries: Deno.DirEntry[];
  try {
    entries = [...Deno.readDirSync(dir)];
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) return;
    throw e;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const url = new URL(entry.name + (entry.isDirectory ? "/" : ""), dir);
    if (entry.isDirectory) yield* sourceFiles(url);
    else if (/\.(ts|tsx|js|mjs)$/.test(entry.name) && !entry.name.endsWith("database.types.ts")) {
      yield url;
    }
  }
}

Deno.test("every Edge Function an app names has a folder", async () => {
  const folders = new Set<string>();
  for await (const entry of Deno.readDir(FUNCTIONS_DIR)) {
    if (entry.isDirectory && entry.name !== "_shared") folders.add(entry.name);
  }
  const missing: string[] = [];
  let scanned = 0;
  for (const app of APPS) {
    for await (const file of sourceFiles(new URL(`apps/${app}/src/`, REPO_ROOT))) {
      scanned++;
      const text = await Deno.readTextFile(file);
      for (const m of text.matchAll(NAME)) {
        if (!folders.has(m[1])) {
          missing.push(`${file.pathname.split("/apps/")[1]} → ${m[1]}`);
        }
      }
    }
  }
  // A walk that found nothing would pass vacuously.
  assertEquals(scanned > 100, true, `scanned only ${scanned} app files`);
  assertEquals(
    [...new Set(missing)],
    [],
    `apps name Edge Functions that have no folder (retired, renamed or typo'd):\n`,
  );
});
