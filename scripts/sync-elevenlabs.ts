// deno task sync-elevenlabs — rewrite elevenlabs/ from the agents' source
// (MESITA-3972). The source is supabase/supabase/functions/_shared/reservationist/;
// elevenlabs/ is its generated mirror (mirror.test.ts pins it).

import { mirrorFiles } from "../supabase/supabase/functions/_shared/reservationist/mirror.ts";

const root = new URL("../elevenlabs/", import.meta.url);
const files = await mirrorFiles();
await Deno.mkdir(new URL("agents/", root), { recursive: true });
for await (const e of Deno.readDir(new URL("agents/", root))) {
  if (!(`agents/${e.name}` in files)) await Deno.remove(new URL(`agents/${e.name}`, root));
}
for (const [path, content] of Object.entries(files)) {
  await Deno.writeTextFile(new URL(path, root), content);
}
console.log(`elevenlabs/: ${Object.keys(files).length} files written`);
