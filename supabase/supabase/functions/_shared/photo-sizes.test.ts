import { assertEquals } from "jsr:@std/assert@1";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { isSizePath, savePhotoSizes, sizePath } from "./photo-sizes.ts";

function fakeAdmin(uploads: { path: string; type: string }[]) {
  return {
    storage: {
      from: () => ({
        upload: (path: string, _bytes: Uint8Array, opts: { contentType: string }) => {
          uploads.push({ path, type: opts.contentType });
          return Promise.resolve({ error: null });
        },
      }),
    },
  } as unknown as SupabaseClient;
}

Deno.test("sizePath and isSizePath agree", () => {
  assertEquals(sizePath("images/a.jpg", 640), "images/a.jpg@640.webp");
  assertEquals(isSizePath("images/a.jpg@640.webp"), true);
  assertEquals(isSizePath("images/a.jpg"), false);
});

Deno.test("saves the three sizes as webp next to the original", async () => {
  const uploads: { path: string; type: string }[] = [];
  const asked: string[] = [];
  const fetchImpl = ((url: string) => {
    asked.push(url);
    return Promise.resolve(
      new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "image/webp" } }),
    );
  }) as unknown as typeof fetch;
  const out = await savePhotoSizes(
    fakeAdmin(uploads),
    "https://x.supabase.co/",
    "place-images",
    "images/a.jpg",
    fetchImpl,
  );
  assertEquals(out, { saved: 3, errors: [] });
  assertEquals(uploads.map((u) => u.path).sort(), [
    "images/a.jpg@1280.webp",
    "images/a.jpg@160.webp",
    "images/a.jpg@640.webp",
  ]);
  assertEquals(uploads.every((u) => u.type === "image/webp"), true);
  assertEquals(
    asked.every((u) => u.startsWith("https://x.supabase.co/storage/v1/render/image/public/place-images/images/a.jpg?width=")),
    true,
  );
});

Deno.test("a failed render uploads nothing for that size and never throws", async () => {
  const uploads: { path: string; type: string }[] = [];
  const fetchImpl = ((url: string) =>
    Promise.resolve(
      url.includes("width=1280")
        ? new Response("no", { status: 500 })
        : new Response(new Uint8Array([1]), { headers: { "content-type": "image/webp" } }),
    )) as unknown as typeof fetch;
  const out = await savePhotoSizes(fakeAdmin(uploads), "https://x.supabase.co", "b", "p.jpg", fetchImpl, 0);
  assertEquals(out.saved, 2);
  assertEquals(uploads.length, 2);
});

Deno.test("a size path is never resized again", async () => {
  const uploads: { path: string; type: string }[] = [];
  const out = await savePhotoSizes(fakeAdmin(uploads), "https://x", "b", "p.jpg@640.webp");
  assertEquals(out, { saved: 0, errors: [] });
});
