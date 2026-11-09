import { assertEquals, assertMatch } from "jsr:@std/assert";
import { photoObjectPath, sniffImageType } from "./photo-upload.ts";

const bytes = (...head: number[]) => new Uint8Array([...head, ...new Array(16).fill(0)]);
const text = (s: string) => [...s].map((c) => c.charCodeAt(0));

Deno.test("sniffImageType reads the bytes, not the name", () => {
  assertEquals(sniffImageType(bytes(0xff, 0xd8, 0xff, 0xe0))?.mime, "image/jpeg");
  assertEquals(sniffImageType(bytes(0x89, 0x50, 0x4e, 0x47))?.mime, "image/png");
  assertEquals(sniffImageType(bytes(...text("RIFF"), 0, 0, 0, 0, ...text("WEBP")))?.mime, "image/webp");
  assertEquals(sniffImageType(bytes(0, 0, 0, 0x1c, ...text("ftypavif"))), null);
  assertEquals(sniffImageType(bytes(...text("<svg xmlns"))), null);
  assertEquals(sniffImageType(bytes(...text("%PDF-1.7"))), null);
  assertEquals(sniffImageType(new Uint8Array([0xff, 0xd8])), null);
});

Deno.test("photoObjectPath stays in the place's folder", () => {
  const id = "11111111-1111-1111-1111-111111111111";
  assertMatch(photoObjectPath(id, "jpg"), new RegExp(`^business/${id}/\\d+-[0-9a-f-]+\\.jpg$`));
});
