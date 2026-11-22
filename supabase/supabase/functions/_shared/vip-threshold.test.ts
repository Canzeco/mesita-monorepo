// MESITA-4639 — the VIP bar lives twice: VIP_MIN_FOLLOWERS (every word a guest
// or owner reads) and the literal in consumers.guest_class's generated
// expression (a generated column cannot read config). This pins them: the
// latest migration that sets guest_class's expression must use `> ${VIP_MIN_FOLLOWERS}`.
import { assert, assertEquals } from "jsr:@std/assert@1";
import { VIP_MIN_FOLLOWERS } from "./money-state.ts";

Deno.test("guest_class's latest expression uses VIP_MIN_FOLLOWERS", () => {
  const dir = new URL("../../migrations/", import.meta.url);
  const files = [...Deno.readDirSync(dir)].map((e) => e.name).filter((n) => n.endsWith(".sql")).sort();
  const setting = files.filter((n) =>
    /alter column guest_class set expression/i.test(Deno.readTextFileSync(new URL(n, dir)))
  );
  assert(setting.length > 0, "no migration sets guest_class's expression");
  const latest = Deno.readTextFileSync(new URL(setting[setting.length - 1], dir));
  const m = latest.match(/instagram_followers_count,\s*0\)\s*>\s*(\d+)/);
  assert(m, "the latest guest_class expression has no follower bar");
  assertEquals(Number(m[1]), VIP_MIN_FOLLOWERS);
});
