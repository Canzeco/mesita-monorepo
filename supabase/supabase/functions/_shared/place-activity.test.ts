import { assertEquals } from "jsr:@std/assert@1";
import {
  type ActivityRow,
  groupFeed,
  isActivityKind,
  isMesitaPlaceId,
  orderFeed,
  socialLine,
  toPerson,
} from "./place-activity.ts";

const P1 = "11111111-1111-4111-8111-111111111111";
const P2 = "22222222-2222-4222-8222-222222222222";

function row(over: Partial<ActivityRow>): ActivityRow {
  return {
    consumer_id: "a",
    place_id: P1,
    kind: "saved",
    created_at: "2026-10-19T10:00:00Z",
    first_name: "Perdón",
    avatar_url: null,
    instagram_handle: "perdon",
    instagram_followers_count: 1200,
    ...over,
  };
}

Deno.test("only the three kinds, only Mesita place ids", () => {
  assertEquals(["saved", "viewed", "went", "liked"].map(isActivityKind), [true, true, true, false]);
  assertEquals(isMesitaPlaceId(P1), true);
  assertEquals(isMesitaPlaceId("g:ChIJ123"), false);
});

Deno.test("a person falls back to the handle, and the viewer is You", () => {
  assertEquals(toPerson(row({ first_name: null }), "z").name, "@perdon");
  assertEquals(toPerson(row({}), "a").isYou, true);
});

Deno.test("same place + same verb collapses, newest leads", () => {
  const groups = groupFeed(
    [
      row({ consumer_id: "a", created_at: "2026-10-19T09:00:00Z" }),
      row({ consumer_id: "b", first_name: "Ana", created_at: "2026-10-19T11:00:00Z" }),
      row({ consumer_id: "c", created_at: "2026-10-19T08:00:00Z" }),
      row({ consumer_id: "a", kind: "went" }),
      row({ consumer_id: "a", place_id: P2 }),
    ],
    "z",
  );
  assertEquals(groups.length, 3);
  const saved = groups.find((g) => g.placeId === P1 && g.kind === "saved")!;
  assertEquals(saved.lead.name, "Ana");
  assertEquals(saved.others, 2);
  assertEquals(saved.at, "2026-10-19T11:00:00Z");
  assertEquals(saved.people.length, 3);
});

Deno.test("newest day first; nearby first within a day", () => {
  const now = new Date("2026-10-19T20:00:00Z");
  const out = orderFeed(
    [
      { id: "old-near", at: "2026-10-17T19:00:00Z", distanceKm: 0.1 },
      { id: "today-far", at: "2026-10-19T19:00:00Z", distanceKm: 9 },
      { id: "today-near", at: "2026-10-19T08:00:00Z", distanceKm: 1 },
      { id: "today-unknown", at: "2026-10-19T19:30:00Z", distanceKm: null },
    ],
    now,
  );
  assertEquals(out.map((i) => i.id), ["today-near", "today-far", "today-unknown", "old-near"]);
});

Deno.test("the profile line", () => {
  const p = toPerson(row({}), "z");
  assertEquals(socialLine(null, 0), null);
  assertEquals(socialLine(p, 1), "Perdón saw this");
  assertEquals(socialLine(p, 2), "Perdón and 1 other saw this");
  assertEquals(socialLine(p, 4), "Perdón and 3 others saw this");
  assertEquals(socialLine(toPerson(row({}), "a"), 3), "You and 2 others saw this");
});
