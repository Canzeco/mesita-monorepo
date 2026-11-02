// MESITA-3120/3123: an editor edits the profile; only the owner (or Mesita
// staff) manages the team and Premier money. Each owner-only door asks
// canManage before it writes anything.
import { assert } from "jsr:@std/assert@1";

const DOORS = [
  "business-web-invite-editor",
  "business-web-remove-member",
  "business-web-transfer-owner",
  "business-web-start-premier",
  "business-web-cancel-premier",
];

const WRITES = [".insert(", ".update(", ".delete(", ".upsert(", ".rpc(", "startPremier(", "cancelPremier(", "stopPremierAsPlace("];

for (const door of DOORS) {
  Deno.test(`${door} refuses editors before any write`, async () => {
    const src = await Deno.readTextFile(new URL(`../${door}/index.ts`, import.meta.url));
    const code = src.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
    const gate = code.indexOf("canManage(access.role)");
    assert(gate > 0, `${door} calls canManage`);
    for (const w of WRITES) {
      const at = code.indexOf(w);
      if (at >= 0) assert(gate < at, `${door}: canManage comes before ${w}`);
    }
  });
}
