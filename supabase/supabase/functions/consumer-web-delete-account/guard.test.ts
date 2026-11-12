import { assertEquals } from "jsr:@std/assert@1";
import { closeGuard, type CloseGuardDeps } from "./guard.ts";

// A shared Google account must never lose Business or Admin because its
// owner closed the guest account (MESITA-3777). The refusal is a 409 with a
// plain message; anything else may close.

const yes = () => Promise.resolve({ ok: true as const, value: true });
const no = () => Promise.resolve({ ok: true as const, value: false });
const boom = () => Promise.resolve({ ok: false as const, error: "down" });

function d(managesPlace: CloseGuardDeps["managesPlace"], isSuperAdmin: CloseGuardDeps["isSuperAdmin"]): CloseGuardDeps {
  return { managesPlace, isSuperAdmin };
}

Deno.test("a guest who runs no place and is not an admin may close", async () => {
  assertEquals(await closeGuard(d(no, no)), { ok: true });
});

Deno.test("a place owner is refused with runs_a_place", async () => {
  const res = await closeGuard(d(yes, no));
  assertEquals(res.ok, false);
  if (!res.ok) {
    assertEquals(res.status, 409);
    assertEquals(res.body.code, "runs_a_place");
  }
});

Deno.test("a super-admin is refused with is_admin", async () => {
  const res = await closeGuard(d(no, yes));
  if (res.ok) throw new Error("expected a refusal");
  assertEquals(res.body.code, "is_admin");
});

Deno.test("a failed read refuses (500) rather than closing blind", async () => {
  const a = await closeGuard(d(boom, no));
  const b = await closeGuard(d(no, boom));
  assertEquals([a.ok, b.ok], [false, false]);
  if (!a.ok && !b.ok) assertEquals([a.status, b.status], [500, 500]);
});
