// MESITA-1362: the 6×7 Sourcing matrix is gone. Folders and config.toml
// blocks for get/update sourcing-config must not return; leftover cloud
// names are deleted by supabase-deploy.yml.

import { assertEquals } from "jsr:@std/assert@1";

const FUNCTIONS_DIR = new URL("../", import.meta.url);
const CONFIG_TOML = new URL("../../config.toml", import.meta.url);

const RETIRED = [
  "admin-web-get-sourcing-config",
  "admin-web-update-sourcing-config",
];

Deno.test("MESITA-1362: no sourcing-config function folders", async () => {
  const leftovers: string[] = [];
  for await (const entry of Deno.readDir(FUNCTIONS_DIR)) {
    if (entry.isDirectory && RETIRED.includes(entry.name)) {
      leftovers.push(entry.name);
    }
  }
  assertEquals(leftovers, [], `leftover sourcing-config folders: ${leftovers.join(", ")}`);
});

Deno.test("MESITA-1362: config.toml declares no sourcing-config functions", async () => {
  const text = await Deno.readTextFile(CONFIG_TOML);
  const hits = RETIRED.filter((name) =>
    text.includes(`[functions.${name}]`)
  );
  assertEquals(hits, [], `leftover [functions.*sourcing-config] blocks: ${hits.join(", ")}`);
});
