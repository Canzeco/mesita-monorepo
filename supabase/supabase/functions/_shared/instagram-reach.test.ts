import { assertEquals } from "jsr:@std/assert@1";

// Duplicate + pin (place-families-parity.test.ts): the database decides who may
// use Instagram Story (place_reward_story_followers, MESITA-3224), the app says
// who has reach. supabase CI's path filter watches apps/web-consumer/src, so an
// edit on either side runs this.
const WEB = new URL(
  "../../../../apps/web-consumer/src/lib/consumer-identity.ts",
  import.meta.url,
);
const MIGRATIONS = new URL("../../migrations/", import.meta.url);

/** The last definition wins, as it does on the database. */
async function databaseBar(): Promise<number> {
  const names: string[] = [];
  for await (const f of Deno.readDir(MIGRATIONS)) names.push(f.name);
  let bar: number | null = null;
  for (const name of names.sort()) {
    const sql = await Deno.readTextFile(new URL(name, MIGRATIONS));
    const m = sql.match(/place_reward_story_followers\(\)\s+returns integer[\s\S]*?select (\d+) /);
    if (m) bar = Number(m[1]);
  }
  if (bar === null) throw new Error("place_reward_story_followers not found in migrations");
  return bar;
}

Deno.test("the database's follower bar equals the app's", async () => {
  const src = await Deno.readTextFile(WEB);
  const m = src.match(/export const INSTAGRAM_REACH_FOLLOWERS\s*=\s*([\d_]+);/);
  if (!m) throw new Error("INSTAGRAM_REACH_FOLLOWERS not found in consumer-identity.ts");
  assertEquals(Number(m[1].replaceAll("_", "")), await databaseBar());
});
