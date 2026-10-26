import { assertEquals } from "jsr:@std/assert@1";
import { galleryFromPatch, galleryUrls, patchWithoutGallery } from "./photos.ts";

Deno.test("the gallery keeps ten http links and drops the rest", () => {
  const urls = Array.from({ length: 12 }, (_, i) => `https://example.com/${i}.jpg`);
  assertEquals(galleryUrls([...urls, "not-a-url", "https://example.com/0.jpg"]).length, 10);
  assertEquals(galleryUrls("https://example.com/a.jpg"), []);
});

Deno.test("the gallery is photos; an older Render's mesita_photos still lands", () => {
  assertEquals(
    galleryFromPatch({
      photos: ["https://example.com/p.jpg"],
      mesita_photos: ["https://example.com/m.jpg"],
    }),
    ["https://example.com/p.jpg"],
  );
  assertEquals(
    galleryFromPatch({ mesita_photos: ["https://example.com/m.jpg"] }),
    ["https://example.com/m.jpg"],
  );
});

Deno.test("patchWithoutGallery drops every gallery key", () => {
  assertEquals(
    patchWithoutGallery({
      google_name: "Pujol",
      photos: ["x"],
      mesita_photos: ["y"],
      google_photos: ["z"],
      description: "d",
    }),
    { google_name: "Pujol", description: "d" },
  );
});
