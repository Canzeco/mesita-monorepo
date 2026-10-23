import { describe, expect, it } from "vitest";
import { effectivePlacePhotos } from "./effective-place-photos";

describe("effectivePlacePhotos", () => {
  it("prefers mesita, then google, then legacy photos", () => {
    expect(
      effectivePlacePhotos({
        photos: ["legacy.jpg"],
        google_photos: ["g.jpg"],
        mesita_photos: ["m.jpg"],
      }),
    ).toEqual(["m.jpg"]);
    expect(
      effectivePlacePhotos({ photos: ["legacy.jpg"], google_photos: ["g.jpg"] }),
    ).toEqual(["g.jpg"]);
    expect(effectivePlacePhotos({ photos: ["legacy.jpg"] })).toEqual(["legacy.jpg"]);
  });
});
