// MESITA-4849 — money: VIP is by invitation code only until the Instagram DM
// bot proves who owns an account. The latest migration that sets guest_class,
// and the latest that defines consumer_is_vip_for_money, read no Instagram.
import { assert } from "jsr:@std/assert@1";

const dir = new URL("../../migrations/", import.meta.url);

function latest(find: RegExp, end: string): string {
  const texts = [...Deno.readDirSync(dir)].map((e) => e.name).filter((n) => n.endsWith(".sql")).sort()
    .map((n) => Deno.readTextFileSync(new URL(n, dir))).filter((t) => find.test(t));
  assert(texts.length > 0, `no migration matches ${find}`);
  const text = texts[texts.length - 1];
  const start = text.search(find);
  return text.slice(start, text.indexOf(end, start));
}

for (
  const [name, body] of [
    ["guest_class", latest(/alter column guest_class set expression/i, ";")],
    ["consumer_is_vip_for_money", latest(/create or replace function public\.consumer_is_vip_for_money/i, "$function$;")],
  ]
) {
  Deno.test(`${name} reads the invitation only, never Instagram`, () => {
    assert(/vip_invited_at/.test(body));
    assert(!/instagram/i.test(body));
  });
}
