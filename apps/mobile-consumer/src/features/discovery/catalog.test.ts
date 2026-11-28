import { rankSchema } from "./api";
import { chipsFor, questionOf } from "./families";
import { DISTRITO_TEC, factsOf, PAGE, pageIds, readActiveLocation, uniquePlaces, withDefaultLocation, type CatalogPlace } from "./model";
import { withSaved } from "./queries";

const PLACE: CatalogPlace = {
  id: "a", slug: null, name: "Pinto", category: "Bar", photo: "p1", priceLevel: 2, rating: 4.4, reviews: 2150,
  hours: null, timezone: null, zone: "Centro", distanceKm: 0.31, isPremier: false, isAd: false, lat: null, lng: null,
};

test("a place keeps only what it can read", () => {
  const rank = rankSchema.parse({
    order: ["a", "b"],
    adIds: "gone",
    newer: true,
    places: [
      { id: "a", name: "Pinto", photos: ["http://old", "https://p1"], ad: true, price_level: "2", boost_tier: 2, offers: {} },
      { id: "b", photos: null, name: 5, price_level: {} },
    ],
  });
  expect(rank.adIds).toEqual([]);
  expect(rank.places[0]).toMatchObject({ name: "Pinto", photo: "https://p1", priceLevel: 2, isPremier: true, isAd: true });
  expect(rank.places[1]).toMatchObject({ name: "", photo: null, priceLevel: null, isPremier: false, isAd: false });
  expect(rankSchema.safeParse({ order: ["a"], places: [{ name: "no id" }] }).success).toBe(false);
});

test("a card prints what it knows and guesses nothing", () => {
  expect(factsOf(PLACE)).toEqual({
    kind: "Bar", price: "$$", rating: "4.4", reviews: "2.1K", open: null, distance: "0.3 km",
  });
  const bare = { ...PLACE, category: "undefined", priceLevel: null, rating: null, reviews: 0, zone: " ", distanceKm: 0 };
  expect(Object.values(factsOf(bare)).every((v) => v === null)).toBe(true);
  const all = [{ open: "00:00", close: "24:00" }];
  const hours = Object.fromEntries(["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"].map((d) => [d, all]));
  expect(factsOf({ ...PLACE, hours, timezone: "America/Monterrey" }).open).toEqual({ now: true, when: null });
  const keys = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const today = new Intl.DateTimeFormat("en-US", { timeZone: "America/Monterrey", weekday: "long" })
    .format(new Date())
    .toLowerCase();
  const tomorrow = keys[(keys.indexOf(today) + 1) % 7];
  const shut = Object.fromEntries(
    keys.map((d) => [d, d === tomorrow ? [{ open: "08:30", close: "22:00" }] : []]),
  );
  expect(factsOf({ ...PLACE, hours: shut, timezone: "America/Monterrey" }).open).toEqual({
    now: false,
    when: "Open tomorrow",
  });
});

test("a chip asks its own question, and Saved is a member's", () => {
  expect(questionOf("near")).toEqual({ rankMode: "nearby", familyKeys: [] });
  expect(questionOf("all").rankMode).toBe("popular");
  expect(questionOf("drinks")).toEqual({ rankMode: "family", familyKeys: ["drinks"] });
  expect(chipsFor(false).map((c) => c.key)).not.toContain("saved");
  expect(chipsFor(true)).toHaveLength(28);
  expect(chipsFor(false, true).map((c) => c.key).slice(0, 3)).toEqual(["social", "near", "all"]);
});

test("saving shows at once and unsaving takes it back", () => {
  const one = withSaved(undefined, PLACE, true);
  expect(one.ids).toEqual(["a"]);
  expect(withSaved(one, PLACE, true).ids).toEqual(["a"]);
  expect(withSaved(one, PLACE, false)).toEqual({ ids: [], places: [] });
});

test("pages walk the whole order once", () => {
  const order = Array.from({ length: 20 + PAGE + 5 }, (_, i) => String(i));
  expect([...order.slice(0, 20), ...pageIds(order, 20, 1), ...pageIds(order, 20, 2)]).toEqual(order);
  expect(pageIds(order, 20, 3)).toEqual([]);
  const p = PLACE;
  expect(uniquePlaces([[p], [p, { ...p, id: "b" }]]).map((x) => x.id)).toEqual(["a", "b"]);
});

test("a saved location that cannot be read is none", () => {
  expect(readActiveLocation('{"lat":1,"lng":2,"name":"Roma"}')).toEqual({ lat: 1, lng: 2, name: "Roma" });
  for (const bad of [null, "", "{", '{"lat":"1","lng":2}', "null"]) expect(readActiveLocation(bad)).toBeNull();
});

test("no stored location is Distrito Tec", () => {
  expect(withDefaultLocation(null)).toEqual(DISTRITO_TEC);
  expect(withDefaultLocation({ lat: 1, lng: 2, name: "Roma" }).name).toBe("Roma");
});
