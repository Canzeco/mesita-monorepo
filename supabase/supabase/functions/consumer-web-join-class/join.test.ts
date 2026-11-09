import { assertEquals } from "jsr:@std/assert@1";
import type { ClassJoinRow, VipRedeemOutcome } from "../_shared/consumer-doc.ts";
import { handleJoin, type JoinDeps, mergeNote, parseJoinBody } from "./join.ts";

// Who becomes VIP is a data write a guest triggers on themself (MESITA-3054):
// the server, not the page, decides. A code is checked, used and the class
// changed by one SQL function (MESITA-3540, pinned in pgTAP
// vip_invitation_codes.test.sql); this file pins how each answer reads.

const REGULAR: ClassJoinRow = {
  guest_class: "regular",
  guest_class_note: null,
};
const CODE = { via: "code", code: "1111-2222-3333" };

function deps(
  opts: {
    row?: ClassJoinRow | null | "read_error";
    write?: "ok" | "write_error";
    redeem?: VipRedeemOutcome | "rpc_error";
  } = {},
): JoinDeps & { written: string[]; redeemed: string[] } {
  const { row = REGULAR, write = "ok", redeem = "joined" } = opts;
  const written: string[] = [];
  const redeemed: string[] = [];
  return {
    written,
    redeemed,
    requestId: "req-1",
    redeemCode: (code) => {
      redeemed.push(code);
      return Promise.resolve(
        redeem === "rpc_error" ? { ok: false, message: "db down" } : { ok: true, outcome: redeem },
      );
    },
    readRow: () =>
      Promise.resolve(row === "read_error" ? { ok: false, message: "db down" } : { ok: true, row }),
    writeClass: (guestClass, note) => {
      written.push(`${guestClass}: ${note}`);
      return Promise.resolve(write === "ok" ? { ok: true } : { ok: false, message: "rpc down" });
    },
  };
}

Deno.test("parseJoinBody reads a code or a leave, and nothing else", () => {
  assertEquals(parseJoinBody({ via: "code", code: "1234 5678 9012" }), {
    via: "code",
    code: "123456789012",
  });
  assertEquals(parseJoinBody({ via: "code", code: "12" }), { via: "code", code: null });
  assertEquals(parseJoinBody({ via: "leave" }), { via: "leave" });
  assertEquals(parseJoinBody({ code: "123456789012" }), null);
  assertEquals(parseJoinBody(null), null);
});

// VIP pays for the room; followers are Instagram Story's bar (MESITA-3224).
Deno.test("followers never make a VIP: via instagram is refused and touches nothing", async () => {
  const d = deps();
  const res = await handleJoin({ via: "instagram", followers: 999999 }, d);
  assertEquals([res.status, res.body.code], [400, "bad_request"]);
  assertEquals([d.written, d.redeemed], [[], []]);
});

Deno.test("a code goes to the one redeem as twelve digits; the page never writes the class", async () => {
  const d = deps();
  const res = await handleJoin(CODE, d);
  assertEquals(res.body, { ok: true, guest_class: "vip", joined: true });
  assertEquals(res.log, { via: "code", outcome: "joined", code_last4: "3333" });
  assertEquals(d.redeemed, ["111122223333"]);
  assertEquals(d.written, []);
});

Deno.test("a bad code shape never reaches the redeem", async () => {
  const d = deps();
  const res = await handleJoin({ via: "code", code: "1" }, d);
  assertEquals([res.status, res.body.code], [400, "bad_code"]);
  assertEquals(d.redeemed, []);
});

Deno.test("each redeem outcome has its answer; unknown, used and revoked read the same", async () => {
  const cases: [VipRedeemOutcome | "rpc_error", number, string | undefined, string][] = [
    ["already_vip", 200, undefined, "already_vip"],
    ["invalid", 403, "invalid_code", "invalid_code"],
    ["rate_limited", 429, "too_many_attempts", "too_many_attempts"],
    ["consumer_not_found", 404, "consumer_not_found", "consumer_not_found"],
    ["rpc_error", 500, "join_failed", "error"],
  ];
  for (const [redeem, status, code, outcome] of cases) {
    const res = await handleJoin(CODE, deps({ redeem }));
    assertEquals([res.status, res.body.code, res.log.outcome], [status, code, outcome], redeem);
  }
  const already = await handleJoin(CODE, deps({ redeem: "already_vip" }));
  assertEquals(already.body, { ok: true, guest_class: "vip", joined: false });
  const broken = await handleJoin(CODE, deps({ redeem: "rpc_error" }));
  assertEquals(broken.body.error, "Couldn't change your class right now. Try again.");
  assertEquals([broken.body.request_id, broken.log.cause], ["req-1", "redeem"]);
});

Deno.test("an operator's note is kept behind the leave note, within 280", () => {
  assertEquals(mergeNote("[left] x", "Met at the bar"), "[left] x · Met at the bar");
  assertEquals(mergeNote("[left] x", "  "), "[left] x");
  assertEquals(mergeNote("j", "o".repeat(400)).length, 280);
});

Deno.test("a VIP can leave; a Regular leaving writes nothing", async () => {
  const vip = deps({ row: { guest_class: "vip", guest_class_note: "Partner deal" } });
  const res = await handleJoin({ via: "leave" }, vip);
  assertEquals(res.body, { ok: true, guest_class: "regular", left: true });
  assertEquals(res.log.outcome, "left");
  assertEquals(vip.written, ["regular: [left] Left VIP · Partner deal"]);

  const regular = deps();
  const again = await handleJoin({ via: "leave" }, regular);
  assertEquals(again.body, { ok: true, guest_class: "regular", left: false });
  assertEquals(regular.written, []);

  const cases: [ReturnType<typeof deps>, number, string, string | undefined][] = [
    [deps({ row: { guest_class: "vip", guest_class_note: null }, write: "write_error" }), 500, "join_failed", "consumer_write"],
    [deps({ row: "read_error" }), 500, "join_failed", "consumer_read"],
    [deps({ row: null }), 404, "consumer_not_found", undefined],
  ];
  for (const [d, status, code, cause] of cases) {
    const r = await handleJoin({ via: "leave" }, d);
    assertEquals([r.status, r.body.code, r.log.cause], [status, code, cause]);
  }
});
