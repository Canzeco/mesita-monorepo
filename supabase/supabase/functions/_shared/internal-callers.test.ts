// requireInternalCaller decodes a JWT it does not verify. That is safe only
// on a function whose gateway checks the signature first — verify_jwt = true,
// the SAFETY INVARIANT in internal.ts — and nothing checked it. The list of
// internal endpoints in internal.ts's header had already drifted: it named
// `supabase-*` alone while the three enrich stages and
// enricher-edgefunc-store-place-images ran the same gate (MESITA-2414).
//
// A function counts as gated when its own source CALLS requireInternalCaller.
// Comment lines are dropped first, so a mention is not a call. A new `_shared/` wrapper around
// requireInternalCaller joins GATE in the same PR.

import { assertEquals } from "jsr:@std/assert@1";

const FUNCTIONS_DIR = new URL("../", import.meta.url);
const CONFIG_TOML = new URL("../../config.toml", import.meta.url);
const INTERNAL_TS = new URL("./internal.ts", import.meta.url);

const GATE = /\brequireInternalCaller\(/;
const COMMENT_LINE = /^\s*(?:\/\/|\/\*|\*)/;

async function codeOf(dir: URL): Promise<string> {
  const lines: string[] = [];
  for await (const entry of Deno.readDir(dir)) {
    if (!entry.isFile || !entry.name.endsWith(".ts") || entry.name.endsWith(".test.ts")) continue;
    const text = await Deno.readTextFile(new URL(entry.name, dir));
    lines.push(...text.split("\n").filter((line) => !COMMENT_LINE.test(line)));
  }
  return lines.join("\n");
}

/** Every function folder whose own code runs the internal-caller gate. */
async function gatedFunctions(): Promise<string[]> {
  const gated: string[] = [];
  for await (const entry of Deno.readDir(FUNCTIONS_DIR)) {
    if (!entry.isDirectory || entry.name === "_shared") continue;
    if (GATE.test(await codeOf(new URL(`${entry.name}/`, FUNCTIONS_DIR)))) gated.push(entry.name);
  }
  return gated.sort();
}

/** `verify_jwt` as each `[functions.<name>]` block spells it, or null when the block omits it. */
async function verifyJwtByFunction(): Promise<Map<string, string | null>> {
  const text = await Deno.readTextFile(CONFIG_TOML);
  const out = new Map<string, string | null>();
  for (const block of text.split(/^(?=\[)/m)) {
    const name = block.match(/^\[functions\.([^\]]+)\]/)?.[1];
    if (!name) continue;
    out.set(name, block.match(/^verify_jwt\s*=\s*(\S+)/m)?.[1] ?? null);
  }
  return out;
}

/** The names listed one per line (`//   <name>`) in internal.ts's header. */
async function listedInHeader(): Promise<string[]> {
  const text = await Deno.readTextFile(INTERNAL_TS);
  const header = text.slice(0, text.indexOf("\nimport "));
  return [...header.matchAll(/^\/\/ {3}([a-z0-9-]+)$/gm)].map((m) => m[1]).sort();
}

Deno.test("INTERNAL: every function that runs requireInternalCaller is verify_jwt = true", async () => {
  const verifyJwt = await verifyJwtByFunction();
  const unsafe = (await gatedFunctions())
    .filter((name) => verifyJwt.get(name) !== "true")
    .map((name) => `${name} (verify_jwt = ${verifyJwt.get(name) ?? "unset"})`);
  assertEquals(
    unsafe,
    [],
    `requireInternalCaller trusts a JWT payload it does not verify, so the gateway must ` +
      `verify the signature first. Set verify_jwt = true in supabase/config.toml, or gate ` +
      `the function another way: ${unsafe.join(", ")}`,
  );
});

Deno.test("INTERNAL: internal.ts's header lists exactly the functions that run requireInternalCaller", async () => {
  assertEquals(
    await listedInHeader(),
    await gatedFunctions(),
    "The internal-endpoint list at the top of _shared/internal.ts must name every function " +
      "that runs requireInternalCaller, one per line, " +
      "and nothing else.",
  );
});
