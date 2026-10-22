import { describe, expect, it } from "vitest";

import type { Place } from "../api/places";
import { withCreatedPlaces } from "../created-places";

// Guards what a card's Save writes (MESITA-2683): once a Google card's place
// is created, the card a list draws is the Mesita row, so Save keeps the
// place's real id, never the `g:` stub's, and the place is never drawn twice.

const stub = (gid: string, km: number): Place =>
  ({
    id: `g:${gid}`,
    slug: gid,
    google_place_id: gid,
    name: `Google ${gid}`,
    photos: [],
    distance_km: km,
    googleOnly: true,
    from_google: true,
  }) as Partial<Place> as Place;

const mesita = (id: string, gid: string): Place =>
  ({
    id,
    slug: `${id}-slug`,
    google_place_id: gid,
    name: `Mesita ${id}`,
    photos: ["https://example.com/photo.jpg"],
  }) as Partial<Place> as Place;

describe("withCreatedPlaces", () => {
  it("draws the Mesita row where the Google card stood, with the list's distance", () => {
    const made = new Map([["B", mesita("uuid-b", "B")]]);
    const out = withCreatedPlaces([stub("A", 1), stub("B", 2), stub("C", 3)], made);
    expect(out.map((p) => p.id)).toEqual(["g:A", "uuid-b", "g:C"]);
    expect(out[1].googleOnly).toBeUndefined();
    expect(out[1].photos).toEqual(["https://example.com/photo.jpg"]);
    expect(out[1].distance_km).toBe(2);
  });

  it("never draws the place twice when the list already holds its Mesita row", () => {
    const made = new Map([["B", mesita("uuid-b", "B")]]);
    const out = withCreatedPlaces([stub("B", 2), mesita("uuid-b", "B")], made);
    expect(out.map((p) => p.id)).toEqual(["uuid-b"]);
  });
});
