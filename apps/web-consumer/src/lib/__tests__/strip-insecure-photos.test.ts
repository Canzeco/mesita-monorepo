import { describe, expect, it } from "vitest";

import { stripInsecurePhotos } from "@/lib/api/places";

describe("stripInsecurePhotos", () => {
  it("keeps a Google photoUri and drops http", () => {
    const google = "https://lh3.googleusercontent.com/places/abc=s800";
    expect(
      stripInsecurePhotos({ photos: [google, "http://old.example/a.jpg"] })
        .photos,
    ).toEqual([google]);
  });
});
