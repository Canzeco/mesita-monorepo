// MESITA-2856: every Edge Function serves through serveJson (_shared/http.ts),
// so a thrown error reaches the browser as a JSON 500 with CORS instead of the
// runtime's bare 500. A direct `Deno.serve(` anywhere else bypasses that.

import { assertEquals } from "jsr:@std/assert@1";
import { fromFileUrl, join, relative } from "jsr:@std/path@1";

const FUNCTIONS = fromFileUrl(new URL("..", import.meta.url));

function* tsFiles(dir: string): Generator<string> {
  for (const e of Deno.readDirSync(dir)) {
    const p = join(dir, e.name);
    if (e.isDirectory) yield* tsFiles(p);
    else if (e.name.endsWith(".ts") && !e.name.endsWith(".test.ts")) yield p;
  }
}

Deno.test("no Deno.serve( outside serveJson in _shared/http.ts", () => {
  const offenders: string[] = [];
  for (const p of tsFiles(FUNCTIONS)) {
    const rel = relative(FUNCTIONS, p).replaceAll("\\", "/");
    const code = Deno.readTextFileSync(p)
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    const hits = code.split("Deno.serve(").length - 1;
    const allowed = rel === "_shared/http.ts" ? 1 : 0;
    if (hits !== allowed) offenders.push(`${rel} (${hits})`);
  }
  assertEquals(offenders, [], "serve through serveJson from _shared/http.ts");
});

Deno.test("every EF index.ts serves through serveJson", () => {
  const missing: string[] = [];
  for (const e of Deno.readDirSync(FUNCTIONS)) {
    if (!e.isDirectory || e.name.startsWith("_")) continue;
    let code: string;
    try {
      code = Deno.readTextFileSync(join(FUNCTIONS, e.name, "index.ts"));
    } catch {
      continue;
    }
    if (!code.includes(`serveJson("${e.name}",`)) missing.push(e.name);
  }
  assertEquals(missing, []);
});
