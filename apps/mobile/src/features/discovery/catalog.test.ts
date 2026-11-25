import { rankSchema } from "./api";
import { PAGE, pageIds, readActiveLocation, uniquePlaces } from "./model";

test("a place keeps only what it can read", () => {
  const rank = rankSchema.parse({
    order: ["a", "b"],
    adIds: "gone",
    newer: true,
    places: [{ id: "a", name: "Pinto", photos: ["p1"], ad: true, offers: {} }, { id: "b", photos: null, name: 5 }],
  });
  expect(rank.adIds).toEqual([]);
  expect(rank.places).toEqual([
    { id: "a", name: "Pinto", category: null, photo: "p1", isAd: true },
    { id: "b", name: "", category: null, photo: null, isAd: false },
  ]);
  expect(rankSchema.safeParse({ order: ["a"], places: [{ name: "no id" }] }).success).toBe(false);
});

test("pages walk the whole order once", () => {
  const order = Array.from({ length: 20 + PAGE + 5 }, (_, i) => String(i));
  expect([...order.slice(0, 20), ...pageIds(order, 20, 1), ...pageIds(order, 20, 2)]).toEqual(order);
  expect(pageIds(order, 20, 3)).toEqual([]);
  const p = { id: "a", name: "", category: null, photo: null, isAd: false };
  expect(uniquePlaces([[p], [p, { ...p, id: "b" }]]).map((x) => x.id)).toEqual(["a", "b"]);
});

test("a saved location that cannot be read is none", () => {
  expect(readActiveLocation('{"lat":1,"lng":2,"name":"Roma"}')).toEqual({ lat: 1, lng: 2, name: "Roma" });
  for (const bad of [null, "", "{", '{"lat":"1","lng":2}', "null"]) expect(readActiveLocation(bad)).toBeNull();
});
