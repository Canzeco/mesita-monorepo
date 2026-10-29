import { assertEquals } from "jsr:@std/assert@1";
import type { ClassJoinRow } from "../_shared/consumer-doc.ts";
import {
  decideInstagram,
  handleJoin,
  type JoinDeps,
  mergeNote,
  parseJoinBody,
} from "./join.ts";

// Who becomes VIP is a data write a guest triggers on themself (MESITA-3054):
// the server, not the page, decides, from the stored row.

const REGULAR: ClassJoinRow = {
  guest_class: "regular",
  instagram_handle: "diego",
  instagram_followers_count: 5000,
  guest_class_note: null,
};

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
    writeVip: (note) => {
      written.push(note);
      return Promise.resolve(write === "ok" ? { ok: true } : { ok: false, message: "rpc down" });
    },
  };
}

Deno.test("the body never supplies a handle or a follower count", () => {
  assertEquals(
    parseJoinBody({ via: "instagram", followers: 999999, handle: "famous" }),
    { via: "instagram" },
  );
  assertEquals(parseJoinBody({ via: "code", code: "1234 5678 9012" }), {
    via: "code",
    code: "123456789012",
  });
  assertEquals(parseJoinBody({ via: "code", code: "12" }), { via: "code", code: null });
  assertEquals(parseJoinBody({ via: "instagrm" }), null);
  assertEquals(parseJoinBody({ code: "123456789012" }), null);
  assertEquals(parseJoinBody(null), null);
});

Deno.test("the Instagram bar is inclusive, and a missing count is not zero", () => {
  const ig = (h: string | null, f: number | null) =>
    decideInstagram({ instagram_handle: h, instagram_followers_count: f }, 1000);
  assertEquals(ig("diego", 1000), { ok: true, handle: "diego", followers: 1000 });
  assertEquals(ig("diego", 999), { ok: false, code: "not_enough_followers", followers: 999 });
  assertEquals(ig("diego", null), { ok: false, code: "followers_unknown" });
  assertEquals(ig(null, 5000), { ok: false, code: "instagram_not_connected" });
});

Deno.test("an Instagram join below the bar writes nothing, whatever the body says", async () => {
  const d = deps({ ...REGULAR, instagram_followers_count: 10 });
  const res = await handleJoin({ via: "instagram", followers: 999999 }, d);
  assertEquals(res.status, 403);
  assertEquals(res.body, {
    ok: false,
    code: "not_enough_followers",
    error: "Needs 1,000 followers.",
    followers: 10,
    needed: 1000,
  });
  assertEquals(d.written, []);
});

Deno.test("each way in writes its tagged note", async () => {
  const ig = deps(REGULAR);
  assertEquals((await handleJoin({ via: "instagram" }, ig)).body, {
    ok: true,
    guest_class: "vip",
    joined: true,
  });
  assertEquals(ig.written, ["[instagram:typed] Joined via Instagram @diego (5,000 followers)"]);

  const code = deps({ ...REGULAR, instagram_handle: null });
  const res = await handleJoin({ via: "code", code: "1234-5678-9012" }, code);
  assertEquals(res.log, { via: "code", outcome: "joined", code_last4: "9012" });
  assertEquals(code.written, ["[code:emulated] Joined with code …9012"]);
});

Deno.test("an operator's note is kept behind the join note, within 280", () => {
  assertEquals(mergeNote("[code:emulated] x", "Met at the bar"), "[code:emulated] x · Met at the bar");
  assertEquals(mergeNote("[code:emulated] x", "  "), "[code:emulated] x");
  assertEquals(mergeNote("j", "o".repeat(400)).length, 280);
});

Deno.test("an already-VIP guest lands on VIP, even below the bar", async () => {
  const d = deps({ ...REGULAR, guest_class: "vip", instagram_followers_count: 5 });
  const res = await handleJoin({ via: "instagram" }, d);
  assertEquals(res.status, 200);
  assertEquals(res.body, { ok: true, guest_class: "vip", joined: false });
  assertEquals(res.log.outcome, "already_vip");
  assertEquals(d.written, []);
});

Deno.test("every exit has its code and outcome; 5xx never carries the database's words", async () => {
  const cases: [unknown, ReturnType<typeof deps>, number, string][] = [
    [{}, deps(REGULAR), 400, "bad_request"],
    [{ via: "code", code: "1" }, deps(REGULAR), 400, "bad_code"],
    [{ via: "instagram" }, deps(null), 404, "consumer_not_found"],
    [{ via: "instagram" }, deps({ ...REGULAR, instagram_handle: null }), 403, "instagram_not_connected"],
    [{ via: "instagram" }, deps({ ...REGULAR, instagram_followers_count: null }), 403, "followers_unknown"],
    [{ via: "instagram" }, deps("read_error"), 500, "join_failed"],
    [{ via: "instagram" }, deps(REGULAR, "write_error"), 500, "join_failed"],
  ];
  for (const [body, d, status, code] of cases) {
    const res = await handleJoin(body, d);
    assertEquals([res.status, res.body.code], [status, code], JSON.stringify(body));
    if (status === 500) {
      assertEquals(res.body.error, "Couldn't join right now. Try again.");
      assertEquals(res.body.request_id, "req-1");
      assertEquals(res.log.outcome, "error");
      assertEquals(res.log.request_id, "req-1");
    } else {
      assertEquals(res.log.outcome, code);
    }
  }
  assertEquals((await handleJoin({ via: "instagram" }, deps("read_error"))).log.cause, "consumer_read");
  assertEquals((await handleJoin({ via: "instagram" }, deps(REGULAR, "write_error"))).log.cause, "consumer_write");
});
