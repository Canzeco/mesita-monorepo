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
  // MESITA-4659: privacy no longer counts toward VIP.
  const expr = latest.slice(latest.search(/alter column guest_class set expression/i));
  const body = expr.slice(0, expr.indexOf(";"));
  assert(!/instagram_is_private/.test(body), "the latest guest_class expression still reads instagram_is_private");
});

// MESITA-4766: the money rule (consumer_is_vip_for_money) carries the same bar.
Deno.test("consumer_is_vip_for_money's latest body uses VIP_MIN_FOLLOWERS", () => {
  const dir = new URL("../../migrations/", import.meta.url);
  const files = [...Deno.readDirSync(dir)].map((e) => e.name).filter((n) => n.endsWith(".sql")).sort();
  const defining = files.filter((n) =>
    /create or replace function public\.consumer_is_vip_for_money/i.test(Deno.readTextFileSync(new URL(n, dir)))
  );
  assert(defining.length > 0, "no migration defines consumer_is_vip_for_money");
  const text = Deno.readTextFileSync(new URL(defining[defining.length - 1], dir));
  const start = text.search(/create or replace function public\.consumer_is_vip_for_money/i);
  const body = text.slice(start, text.indexOf("$function$;", start));
  const bars = [...body.matchAll(/>\s*(\d+)/g)].map((m) => Number(m[1]));
  assert(bars.length > 0, "consumer_is_vip_for_money has no follower bar");
  for (const bar of bars) assertEquals(bar, VIP_MIN_FOLLOWERS);
});
