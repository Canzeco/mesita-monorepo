import { assertEquals } from "jsr:@std/assert@1";
import { mergeNearbyCatalog } from "./nearby-places.ts";

const CENTER = { lat: 25.67, lng: -100.3 };

Deno.test("mergeNearbyCatalog: Mesita row wins the same Google Place ID", () => {
  const mesita = [
    { id: "m1", google_place_id: "ChIJ1", lat: 25.6701, lng: -100.3001 },
    { id: "m2", google_place_id: "ChIJ2", lat: 25.68, lng: -100.31 },
  ];
  const google = [
    {
      placeId: "ChIJ1",
      name: "Dup",
      address: "",
      lat: 25.6701,
      lng: -100.3001,
      rating: 4,
      primaryType: "restaurant",
    },
    {
      placeId: "ChIJ9",
      name: "Google only",
      address: "",
      lat: 25.6702,
      lng: -100.3002,
      rating: 4.2,
      primaryType: "bar",
    },
  ];
  const got = mergeNearbyCatalog(mesita, google, CENTER, 50);
  assertEquals(
    got.filter((x) => x.kind === "listed").map((x) =>
      x.kind === "listed" ? x.row.id : ""
    ),
    ["m1", "m2"],
  );
  assertEquals(
    got.filter((x) => x.kind === "google").map((x) =>
      x.kind === "google" ? x.hit.placeId : ""
    ),
    ["ChIJ9"],
  );
});

Deno.test("mergeNearbyCatalog: closest N, Google-only fills the rail", () => {
  const mesita = Array.from({ length: 3 }, (_, i) => ({
    id: `m${i}`,
    google_place_id: `gid-${i}`,
    lat: 25.67 + i * 0.01,
    lng: -100.3,
  }));
  const google = Array.from({ length: 5 }, (_, i) => ({
    placeId: `gOnly-${i}`,
    name: `G${i}`,
    address: "",
    lat: 25.67005 + i * 0.0001,
    lng: -100.3,
    rating: null,
    primaryType: "cafe",
  }));
  const got = mergeNearbyCatalog(mesita, google, CENTER, 5);
  assertEquals(got.length, 5);
  assertEquals(got[0].kind === "listed" ? got[0].row.id : "", "m0");
});

Deno.test("mergeNearbyCatalog: product cap is 50 closest", () => {
  const mesita = Array.from({ length: 40 }, (_, i) => ({
    id: `m${i}`,
    google_place_id: `mid-${i}`,
    lat: 25.67 + i * 0.001,
    lng: -100.3,
  }));
  const google = Array.from({ length: 30 }, (_, i) => ({
    placeId: `g-${i}`,
    name: `G${i}`,
    address: "",
    lat: 25.67 + i * 0.002,
    lng: -100.31,
    rating: null,
    primaryType: "bar",
  }));
  const got = mergeNearbyCatalog(mesita, google, CENTER, 50);
  assertEquals(got.length, 50);
});
