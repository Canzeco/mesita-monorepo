import { assertEquals } from "jsr:@std/assert@1";
import {
  type ActivityRow,
  feedEvents,
  cleanHandle,
  isActivityKind,
  isMesitaPlaceId,
  maskHandle,
  nearYou,
  seesHandles,
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

Deno.test("only the two kinds, only Mesita place ids (MESITA-2567: no went)", () => {
  assertEquals(["saved", "viewed", "went", "liked"].map(isActivityKind), [
    true,
    true,
    false,
    false,
  ]);
  assertEquals(isMesitaPlaceId(P1), true);
  assertEquals(isMesitaPlaceId("g:ChIJ123"), false);
});

Deno.test("a named person carries the full handle; the name is never it; the viewer is You", () => {
  // MESITA-2590: the full username (MESITA-2522 had cut it to three letters).
  assertEquals(toPerson(row({ first_name: null }), "z").name, "A member");
  assertEquals(toPerson(row({}), "z").handle, "perdon");
  assertEquals(toPerson(row({ instagram_handle: null }), "z").handle, null);
  assertEquals(toPerson(row({}), "a").isYou, true);
  // An anonymous member never carries one, even if the row leaked it.
  assertEquals(toPerson(row({ anonymous: true }), "z").handle, null);
});

// MESITA-2594: you see others' Instagram only if you show yours.
Deno.test("a viewer who does not show their Instagram gets masked handles", () => {
  assertEquals(maskHandle("perdon"), "per***");
  assertEquals(maskHandle("al"), "al***");
  const locked = toPerson(row({}), "z", false);
  assertEquals(locked.handle, "per***");
  assertEquals(locked.handleLocked, true);
  assertEquals(locked.followers, 1200);
  const open = toPerson(row({}), "z", true);
  assertEquals(open.handle, "perdon");
  assertEquals(open.handleLocked, false);
  // Your own handle is never masked to you.
  assertEquals(toPerson(row({}), "a", false).handle, "perdon");
  assertEquals(toPerson(row({}), "a", false).handleLocked, false);
  // No handle, nothing to lock; anonymous stays anonymous.
  assertEquals(toPerson(row({ instagram_handle: null }), "z", false).handleLocked, false);
  assertEquals(toPerson(row({ anonymous: true }), "z", false).handle, null);
  // The feed passes the viewer's standing to every person.
  assertEquals(feedEvents([row({})], "z", false)[0].person.handle, "per***");
});

Deno.test("seesHandles: a verified Instagram and a public profile, both", () => {
  const at = "2026-10-20T00:00:00Z";
  assertEquals(seesHandles({ instagram_verified_at: at, appear_anonymous: false }), true);
  assertEquals(seesHandles({ instagram_verified_at: at, appear_anonymous: null }), true);
  assertEquals(seesHandles({ instagram_verified_at: at, appear_anonymous: true }), false);
  assertEquals(seesHandles({ instagram_verified_at: null, appear_anonymous: false }), false);
  assertEquals(seesHandles(null), false);
});

Deno.test("cleanHandle: lowercase, no @, null when blank", () => {
  assertEquals(cleanHandle("@Perdon "), "perdon");
  assertEquals(cleanHandle("ana_mx"), "ana_mx");
  assertEquals(cleanHandle("  "), null);
  assertEquals(cleanHandle(null), null);
});

// MESITA-2532: one person, one place, one verb per row — never collapsed.
Deno.test("every row is its own event, newest first, never collapsed", () => {
  const events = feedEvents(
    [
      row({ consumer_id: "a", created_at: "2026-10-19T09:00:00Z" }),
      row({
        consumer_id: "b",
        first_name: "Ana",
        created_at: "2026-10-19T11:00:00Z",
      }),
      row({
        consumer_id: "c",
        place_id: P2,
        created_at: "2026-10-18T08:00:00Z",
      }),
      row({ consumer_id: "a", kind: "liked" }),
      row({ consumer_id: "a", place_id: undefined }),
    ],
    "z",
  );
  assertEquals(events.map((e) => e.person.name), ["Ana", "Perdón", "Perdón"]);
  assertEquals(events.map((e) => e.at), [
    "2026-10-19T11:00:00Z",
    "2026-10-19T09:00:00Z",
    "2026-10-18T08:00:00Z",
  ]);
  assertEquals(events.map((e) => e.placeId), [P1, P1, P2]);
  assertEquals(Object.keys(events[0]).sort(), [
    "at",
    "kind",
    "person",
    "placeId",
  ]);
});

Deno.test("near you: inside the circle; no point, no circle", () => {
  assertEquals(nearYou(3, 5, true), true);
  assertEquals(nearYou(5, 5, true), true);
  assertEquals(nearYou(5.1, 5, true), false);
  assertEquals(nearYou(null, 5, true), false);
  assertEquals(nearYou(null, 5, false), true);
  assertEquals(nearYou(900, 5, false), true);
});

Deno.test("the profile line", () => {
  const p = toPerson(row({}), "z");
  assertEquals(socialLine(null, 0), null);
  // MESITA-2594: the line counts likes only, so it says so.
  assertEquals(socialLine(p, 1), "Perdón liked this");
  assertEquals(socialLine(p, 2), "Perdón and 1 other liked this");
  assertEquals(socialLine(p, 4), "Perdón and 3 others liked this");
  assertEquals(
    socialLine(toPerson(row({}), "a"), 3),
    "You and 2 others liked this",
  );
});

// MESITA-2460: a member's account id never goes on the wire; the client
// needs only isYou.
Deno.test("toPerson carries no account id", () => {
  const person = toPerson(
    {
      consumer_id: "11111111-1111-1111-1111-111111111111",
      kind: "saved",
      created_at: "2026-10-19T09:00:00Z",
      first_name: "Ana",
      avatar_url: null,
      instagram_handle: "ana",
      instagram_followers_count: 10,
    },
    "11111111-1111-1111-1111-111111111111",
  );
  assertEquals(Object.keys(person).sort(), [
    "anonymous",
    "avatarUrl",
    "followers",
    "guestClass",
    "handle",
    "handleLocked",
    "isYou",
    "name",
    "plan",
  ]);
  assertEquals(person.isYou, true);
});

// MESITA-2553: Class and Plan ride on the person, independent, plain by default.
Deno.test("a person carries Class and Plan, plain unless set", () => {
  assertEquals(toPerson(row({}), "z").guestClass, "regular");
  assertEquals(toPerson(row({}), "z").plan, "free");
  const vipFree = toPerson(row({ guest_class: "vip", plan: "free" }), "z");
  assertEquals([vipFree.guestClass, vipFree.plan], ["vip", "free"]);
  const regularPremium = toPerson(row({ guest_class: "regular", plan: "premium" }), "z");
  assertEquals([regularPremium.guestClass, regularPremium.plan], ["regular", "premium"]);
  // Old words and unknown values never show a status the member lacks.
  assertEquals(toPerson(row({ plan: "pro" }), "z").plan, "free");
  assertEquals(toPerson(row({ guest_class: "diamond" }), "z").guestClass, "regular");
});

// MESITA-2580: a member without Instagram is in the feed, anonymously.
Deno.test("an anonymous member is 'A member' and nothing else, even if a field leaked", () => {
  const anon = toPerson(
    row({ anonymous: true, first_name: "Leak", avatar_url: "https://x/y.jpg", instagram_handle: "leak", instagram_followers_count: 9000, guest_class: "vip" }),
    "z",
  );
  assertEquals(anon, {
    name: "A member",
    avatarUrl: null,
    handle: null,
    handleLocked: false,
    followers: 0,
    isYou: false,
    guestClass: "regular",
    plan: "free",
    anonymous: true,
  });
  // The guest's own anonymous row still reads as them.
  assertEquals(toPerson(row({ anonymous: true, consumer_id: "z" }), "z").isYou, true);
  assertEquals(toPerson(row({}), "z").anonymous, false);
});
