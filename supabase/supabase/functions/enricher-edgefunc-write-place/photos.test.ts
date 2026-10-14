import { assertEquals } from "jsr:@std/assert@1";
import { galleryUrls } from "./photos.ts";

Deno.test("the gallery keeps ten http links and drops the rest", () => {
  const urls = Array.from({ length: 12 }, (_, i) => `https://example.com/${i}.jpg`);
  assertEquals(galleryUrls([...urls, "not-a-url", "https://example.com/0.jpg"]).length, 10);
  assertEquals(galleryUrls("https://example.com/a.jpg"), []);
});
