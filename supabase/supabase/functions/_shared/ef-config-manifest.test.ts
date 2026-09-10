// config.toml IS the manifest. `supabase functions deploy` reads it, a merge
// to main auto-deploys every Edge Function, and NOTHING checked that the two
// sides agreed. A folder with no [functions.<name>] block still ships — on
// the CLI's silent default, verify_jwt = true, a gateway policy decided by
// omission rather than by anyone. A block with no folder describes an ACL for
// a function that isn't there.
//
// Neither direction failed anything, which is how the repo arrived at 172
// blocks for 192 folders (MESITA-1723) with four of those blocks naming
// functions no app had called in months. Same failure class, same fix, as the
// migration ledger (MESITA-1594) and the EF-name ACL (MESITA-1600): a
// convention no CI job reads is a convention that drifts.
//
// This asserts the two sets are equal in both directions, and that no name is
// declared twice.

import { assertEquals } from "jsr:@std/assert@1";

const FUNCTIONS_DIR = new URL("../", import.meta.url);
const CONFIG_TOML = new URL("../../config.toml", import.meta.url);

/**
 * Deno.readDir is LAZY: on a missing directory it throws NotFound at the
 * FIRST iteration, not at the call. The tempting
 * `try { d = Deno.readDir(p) } catch { return }` guard therefore catches
 * nothing, and the throw surfaces later from inside the for-await, attributed
 * to the wrong line. Stat explicitly, then drain the iterator here, so a bad
 * path fails as this function with this function's message.
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

/** Every function folder on disk. `_shared` is the library, not a function. */
async function functionFolders(): Promise<string[]> {
  return (await readDirEntries(FUNCTIONS_DIR))
    .filter((e) => e.isDirectory && e.name !== "_shared")
    .map((e) => e.name)
    .sort();
}

/** Every `[functions.<name>]` block in config.toml, in file order. */
async function declaredFunctions(): Promise<string[]> {
  const text = await Deno.readTextFile(CONFIG_TOML);
  return [...text.matchAll(/^\[functions\.([^\]]+)\]/gm)].map((m) => m[1]);
}

Deno.test("MANIFEST: every function folder is declared in config.toml", async () => {
  const declared = new Set(await declaredFunctions());
  const undeclared = (await functionFolders()).filter((n) => !declared.has(n));
  assertEquals(
    undeclared,
    [],
    `${undeclared.length} function folder(s) with no [functions.<name>] block in ` +
      `supabase/config.toml: ${undeclared.join(", ")}. An undeclared function still ` +
      `deploys, on the CLI default verify_jwt = true — add the block next to the ` +
      `functions it belongs with, and say in a comment what gates it.`,
  );
});

Deno.test("MANIFEST: every config.toml entry has a function folder", async () => {
  const folders = new Set(await functionFolders());
  const orphans = [...new Set(await declaredFunctions())]
    .filter((n) => !folders.has(n))
    .sort();
  assertEquals(
    orphans,
    [],
    `${orphans.length} [functions.<name>] block(s) in supabase/config.toml naming a ` +
      `function that is not on disk: ${orphans.join(", ")}. Delete the block — it ` +
      `reads as live gateway policy for nothing, and it is how a deleted function ` +
      `stays half-deleted.`,
  );
});

Deno.test("MANIFEST: no function is declared twice in config.toml", async () => {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const name of await declaredFunctions()) {
    if (seen.has(name)) duplicates.add(name);
    seen.add(name);
  }
  assertEquals(
    [...duplicates].sort(),
    [],
    `duplicate [functions.<name>] block(s) in supabase/config.toml: ${
      [...duplicates].sort().join(", ")
    }. A repeated table is invalid TOML, so this would otherwise surface as a ` +
      `parse error mid-deploy instead of a name here.`,
  );
});
