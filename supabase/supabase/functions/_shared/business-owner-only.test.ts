// MESITA-3120/3123: an editor edits the profile; only the owner (or Mesita
// staff) manages the team and Premier money. Each owner-only door asks
// canManage before it writes anything. The payer's own card and renewal are
// the exception (MESITA-3130, business-premier-payer-doors.test.ts): those
// calls come before the gate, so this test leaves that one call to the
// payer-door test, which checks it reaches only the caller's own pledge.
import { assert } from "jsr:@std/assert@1";

const DOORS = [
  "business-web-invite-editor",
  "business-web-remove-member",
  "business-web-transfer-owner",
  "business-web-start-premier",
  "business-web-cancel-premier",
  // The owner's money (MESITA-3307): editors get 403 forbidden.
  "business-web-get-place-money",
  // Owners refund their own place's rows (MESITA-3381).
  "business-web-refund-payment",
];

/** The payer door's call, checked by business-premier-payer-doors.test.ts. */
const PAYER_CALL: Record<string, string> = {
  "business-web-cancel-premier": "cancelPremier(",
};

const WRITES = [".insert(", ".update(", ".delete(", ".upsert(", ".rpc(", "startPremier(", "cancelPremier(", "stopPremierAsPlace("];

for (const door of DOORS) {
  Deno.test(`${door} refuses editors before any write`, async () => {
    const src = await Deno.readTextFile(new URL(`../${door}/index.ts`, import.meta.url));
    const code = src.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
    const gate = code.indexOf("canManage(access.role)");
    assert(gate > 0, `${door} calls canManage`);
    for (const w of WRITES) {
      if (PAYER_CALL[door] === w) continue;
      const at = code.indexOf(w);
      if (at >= 0) assert(gate < at, `${door}: canManage comes before ${w}`);
    }
  });
}
