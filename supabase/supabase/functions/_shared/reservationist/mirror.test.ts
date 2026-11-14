import { assertEquals } from "jsr:@std/assert@1";
import { mirrorFiles } from "./mirror.ts";

// elevenlabs/ is generated (MESITA-3972): a change to the agents that is not
// mirrored fails here. Fix: `deno task sync-elevenlabs` at the repo root.
const ROOT = new URL("../../../../../elevenlabs/", import.meta.url);

Deno.test("elevenlabs/ mirrors the agents' source", async () => {
  const want = await mirrorFiles();
  for (const [path, content] of Object.entries(want)) {
    let got = "";
    try {
      got = await Deno.readTextFile(new URL(path, ROOT));
    } catch {
      got = "(missing)";
    }
    assertEquals(got === content, true, `elevenlabs/${path} is stale — run \`deno task sync-elevenlabs\``);
  }
  const present: string[] = [];
  for await (const e of Deno.readDir(new URL("agents/", ROOT))) present.push(`agents/${e.name}`);
  for (const p of present) {
    assertEquals(p in want, true, `elevenlabs/${p} is not generated — delete it`);
  }
});
