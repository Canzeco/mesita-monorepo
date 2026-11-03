// MESITA-3130: whoever pays a place's Premier can always stop renewing it or
// replace its card, even after losing the place (left, removed, handed over,
// claim expired). Those two Business doors skip the place gate, so each must
// reach only the caller's own pledge; buying, switching and stopping a guest's
// Premier stay owner-only (business-owner-only.test.ts).
import { assert, assertMatch } from "jsr:@std/assert@1";

const read = async (path: string) => {
  const src = await Deno.readTextFile(new URL(path, import.meta.url));
  return src.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
};

Deno.test("cancel-premier: the payer's stop is scoped to the caller, as_place keeps the owner gate", async () => {
  const code = await read("../business-web-cancel-premier/index.ts");
  const gate = code.indexOf("canManage(access.role)");
  // Every call before the gate passes the caller's own id.
  const before = code.slice(0, gate);
  const calls = [...before.matchAll(/cancelPremier\(([^)]*)\)/g)].map((m) => m[1]);
  assert(calls.length > 0, "the payer door calls cancelPremier");
  for (const args of calls) assertMatch(args, /^env, user\.id,/);
  assert(!before.includes("stopPremierAsPlace("), "stopping a guest's Premier waits for the gate");
  assert(before.includes('as_place !== true'), "only a non-as_place stop skips the gate");
});

Deno.test("cancelPremier reads and stops only the caller's pledge", async () => {
  const code = await read("./premier-flow.ts");
  const body = code.slice(code.indexOf("export async function cancelPremier("), code.indexOf("export async function stopPremierAsPlace("));
  assert(body.includes('.eq("consumer_id", userId)'), "the place lookup filters by the caller");
  assert(body.includes("pledge.consumer_id !== userId"), "a backing id that is not the caller's is refused");
});

Deno.test("start-premier: only update_card skips the place gate, and startPremier refuses a non-payer", async () => {
  const code = await read("../business-web-start-premier/index.ts");
  const skip = code.indexOf("if (!parsed.start.updateCard)");
  const gate = code.indexOf("canManage(access.role)");
  assert(skip > 0 && skip < gate, "the place gate sits inside the not-update_card branch");
  const flow = await read("./premier-flow.ts");
  assert(
    flow.includes('if (viewer !== "payer" || !subscription) return refuse("not_payer"'),
    "update_card refuses anyone but the payer",
  );
});

Deno.test("list-billing reads only the caller's pledges and asks for no place gate", async () => {
  const code = await read("../business-web-list-billing/index.ts");
  assert(code.includes('.from("place_backings")'), "reads pledges");
  assert(code.includes('.eq("consumer_id", user.id)'), "scoped to the caller");
  assert(!code.includes("requirePlaceAccess("), "no place gate: a former owner still sees what they pay");
});
