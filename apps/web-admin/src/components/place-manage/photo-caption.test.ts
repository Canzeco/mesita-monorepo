import { describe, expect, it } from "vitest";
import { photoCaption } from "./photo-caption";

describe("photo caption", () => {
  it("shows the description stored for that photo", () => {
    expect(photoCaption({
      "https://storage.example/a.jpg": "A chandelier over the floor.",
    }, "https://storage.example/a.jpg")).toBe("A chandelier over the floor.");
  });

  it("stays empty when this photo was never described", () => {
    expect(photoCaption({}, "https://storage.example/a.jpg")).toBeNull();
    expect(photoCaption(null, "https://storage.example/a.jpg")).toBeNull();
  });
});
