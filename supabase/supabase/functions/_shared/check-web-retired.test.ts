// MESITA-1117: the staff ticket EFs live at validate-web-*. The old
// check-web-* folders, config.toml blocks, and cloud functions are gone.
// A leftover name would re-deploy a second public surface that the staff
// app no longer calls.

import { assertEquals } from "jsr:@std/assert@1";

const FUNCTIONS_DIR = new URL("../", import.meta.url);
const CONFIG_TOML = new URL("../../config.toml", import.meta.url);

Deno.test("MESITA-1117: no check-web-* function folders", async () => {
  const leftovers: string[] = [];
  for await (const entry of Deno.readDir(FUNCTIONS_DIR)) {
    if (entry.isDirectory && entry.name.startsWith("check-web-")) {
      leftovers.push(entry.name);
    }
  }
  assertEquals(leftovers, [], `leftover check-web-* folders: ${leftovers.join(", ")}`);
});

Deno.test("MESITA-1117: config.toml declares no check-web-* functions", async () => {
  const text = await Deno.readTextFile(CONFIG_TOML);
  const hits = [...text.matchAll(/^\[functions\.(check-web-[^\]]+)\]/gm)].map((m) => m[1]);
  assertEquals(hits, [], `leftover [functions.check-web-*] blocks: ${hits.join(", ")}`);
});
