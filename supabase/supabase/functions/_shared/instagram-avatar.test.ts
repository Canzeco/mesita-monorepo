import { assertEquals } from "jsr:@std/assert@1";
import {
  avatarExt,
  instagramAvatarPath,
  isInstagramAvatar,
  photoAllowed,
  pickProfilePicUrl,
} from "./instagram-avatar.ts";

const ID = "8b1c2d3e-0000-4000-8000-000000000001";
const BASE = "https://x.supabase.co/storage/v1/object/public/consumer-avatars";

Deno.test("instagram-avatar: the HD photo first, then the plain one, https only", () => {
  assertEquals(
    pickProfilePicUrl({ profilePicUrlHD: "https://cdn/hd.jpg", profilePicUrl: "https://cdn/sd.jpg" }),
    "https://cdn/hd.jpg",
  );
  assertEquals(pickProfilePicUrl({ profilePicUrl: "https://cdn/sd.jpg" }), "https://cdn/sd.jpg");
  assertEquals(pickProfilePicUrl({ profilePicUrlHD: "http://cdn/hd.jpg" }), null);
  assertEquals(pickProfilePicUrl({ profilePicUrlHD: "", profilePicUrl: 3 }), null);
  assertEquals(pickProfilePicUrl({}), null);
});

Deno.test("instagram-avatar: a copy lives in the guest's own folder, named instagram-{ms}", () => {
  assertEquals(instagramAvatarPath(ID, 1700000000000, "jpg"), `${ID}/instagram-1700000000000.jpg`);
});

Deno.test("instagram-avatar: only this guest's instagram- files are copies", () => {
  assertEquals(isInstagramAvatar(`${BASE}/${ID}/instagram-1.jpg`, ID), true);
  // An upload ({ms}-{uuid}.{ext}, MESITA-953) is not a copy, so the sweep keeps it.
  assertEquals(isInstagramAvatar(`${BASE}/${ID}/1700000000000-abc.jpg`, ID), false);
  // Another guest's Instagram copy is not this guest's.
  assertEquals(isInstagramAvatar(`${BASE}/other/instagram-1.jpg`, ID), false);
});

Deno.test("instagram-avatar: only the bucket's image types are stored", () => {
  assertEquals(avatarExt("image/jpeg"), "jpg");
  assertEquals(avatarExt("image/png; charset=binary"), "png");
  assertEquals(avatarExt("IMAGE/WEBP"), "webp");
  assertEquals(avatarExt("image/heic"), null);
  assertEquals(avatarExt("text/html"), null);
  assertEquals(avatarExt(null), null);
});

Deno.test("instagram-avatar: the photo is opt-out — only an explicit false stops it (MESITA-2585)", () => {
  assertEquals(photoAllowed(true), true);
  assertEquals(photoAllowed(undefined), true);
  assertEquals(photoAllowed(null), true);
  assertEquals(photoAllowed(false), false);
});
