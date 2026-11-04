import { assertEquals } from "jsr:@std/assert@1";
import type { ClassJoinRow } from "../_shared/consumer-doc.ts";
import { handleJoin, type JoinDeps, mergeNote, parseJoinBody } from "./join.ts";

// Who becomes VIP is a data write a guest triggers on themself (MESITA-3054):
// the server, not the page, decides, from the stored row.

const REGULAR: ClassJoinRow = {
  guest_class: "regular",
  guest_class_note: null,
};
const CODE = { via: "code", code: "000000000000" };

function deps(
  row: ClassJoinRow | null | "read_error",
  write: "ok" | "write_error" = "ok",
): JoinDeps & { written: string[] } {
  const written: string[] = [];
  return {
    written,
    requestId: "req-1",
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
Deno.test("followers never make a VIP: via instagram is refused and writes nothing", async () => {
  const d = deps(REGULAR);
  const res = await handleJoin({ via: "instagram", followers: 999999 }, d);
  assertEquals([res.status, res.body.code], [400, "bad_request"]);
  assertEquals(d.written, []);
});

Deno.test("a code join writes its tagged note", async () => {
  const code = deps(REGULAR);
  const res = await handleJoin({ via: "code", code: "0000-0000-0000" }, code);
  assertEquals(res.body, { ok: true, guest_class: "vip", joined: true });
  assertEquals(res.log, { via: "code", outcome: "joined", code_last4: "0000" });
  assertEquals(code.written, ["vip: [code:emulated] Joined with code …0000"]);
});

// The emulator takes one code (Pato, MESITA-3071: "12 zeros to accept").
Deno.test("only twelve zeros join; any other twelve digits is refused, unwritten", async () => {
  const d = deps(REGULAR);
  const res = await handleJoin({ via: "code", code: "1234 5678 9012" }, d);
  assertEquals(res.status, 403);
  assertEquals(res.body, { ok: false, code: "invalid_code", error: "That code isn't valid." });
  assertEquals(res.log, { via: "code", outcome: "invalid_code", code_last4: "9012" });
  assertEquals(d.written, []);
});

Deno.test("an operator's note is kept behind the join note, within 280", () => {
  assertEquals(mergeNote("[code:emulated] x", "Met at the bar"), "[code:emulated] x · Met at the bar");
  assertEquals(mergeNote("[code:emulated] x", "  "), "[code:emulated] x");
  assertEquals(mergeNote("j", "o".repeat(400)).length, 280);
});

Deno.test("a VIP can leave; a Regular leaving writes nothing", async () => {
  const vip = deps({ ...REGULAR, guest_class: "vip", guest_class_note: "Partner deal" });
  const res = await handleJoin({ via: "leave" }, vip);
  assertEquals(res.body, { ok: true, guest_class: "regular", left: true });
  assertEquals(res.log.outcome, "left");
  assertEquals(vip.written, ["regular: [left] Left VIP · Partner deal"]);

  const regular = deps(REGULAR);
  const again = await handleJoin({ via: "leave" }, regular);
  assertEquals(again.body, { ok: true, guest_class: "regular", left: false });
  assertEquals(regular.written, []);

  const broken = await handleJoin({ via: "leave" }, deps({ ...REGULAR, guest_class: "vip" }, "write_error"));
  assertEquals([broken.status, broken.body.code, broken.log.cause], [500, "join_failed", "consumer_write"]);
});

Deno.test("an already-VIP guest lands on VIP and writes nothing", async () => {
  const d = deps({ ...REGULAR, guest_class: "vip" });
  const res = await handleJoin(CODE, d);
  assertEquals(res.status, 200);
  assertEquals(res.body, { ok: true, guest_class: "vip", joined: false });
  assertEquals(res.log.outcome, "already_vip");
  assertEquals(d.written, []);
});

Deno.test("every exit has its code and outcome; 5xx never carries the database's words", async () => {
  const cases: [unknown, ReturnType<typeof deps>, number, string][] = [
    [{}, deps(REGULAR), 400, "bad_request"],
    [{ via: "code", code: "1" }, deps(REGULAR), 400, "bad_code"],
    [CODE, deps(null), 404, "consumer_not_found"],
    [CODE, deps("read_error"), 500, "join_failed"],
    [CODE, deps(REGULAR, "write_error"), 500, "join_failed"],
  ];
  for (const [body, d, status, code] of cases) {
    const res = await handleJoin(body, d);
    assertEquals([res.status, res.body.code], [status, code], JSON.stringify(body));
    if (status === 500) {
      assertEquals(res.body.error, "Couldn't change your class right now. Try again.");
      assertEquals(res.body.request_id, "req-1");
      assertEquals(res.log.outcome, "error");
      assertEquals(res.log.request_id, "req-1");
    } else {
      assertEquals(res.log.outcome, code);
    }
  }
  assertEquals((await handleJoin(CODE, deps("read_error"))).log.cause, "consumer_read");
  assertEquals((await handleJoin(CODE, deps(REGULAR, "write_error"))).log.cause, "consumer_write");
});
