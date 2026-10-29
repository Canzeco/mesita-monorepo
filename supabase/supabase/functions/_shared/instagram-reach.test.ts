import { assertEquals } from "jsr:@std/assert@1";
import { INSTAGRAM_REACH_FOLLOWERS } from "./instagram-reach.ts";

// Duplicate + pin (place-families-parity.test.ts): the server decides who may
// join VIP with Instagram, the app decides whether the button is unlocked.
// supabase CI's path filter watches apps/web-consumer/src, so an edit on
// either side runs this.
const WEB = new URL(
  "../../../../apps/web-consumer/src/lib/consumer-identity.ts",
  import.meta.url,
);

Deno.test("the server's follower bar equals the app's", async () => {
  const src = await Deno.readTextFile(WEB);
  const m = src.match(/export const INSTAGRAM_REACH_FOLLOWERS\s*=\s*([\d_]+);/);
  if (!m) throw new Error("INSTAGRAM_REACH_FOLLOWERS not found in consumer-identity.ts");
  assertEquals(Number(m[1].replaceAll("_", "")), INSTAGRAM_REACH_FOLLOWERS);
});
