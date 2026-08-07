import { assertEquals } from "jsr:@std/assert";
import {
  buildProfilePatch,
  parseAvatarUrl,
  parseName,
} from "./update-profile-fields.ts";

// The name pair is the reservation's booking name — a consumer with only
// half of it can't be booked with the venue, so the EF refuses the write.

Deno.test("parseName: both halves present", () => {
  const res = parseName(
    { first_name: "Ana", last_name: "Ruiz" },
    "Ana",
    "Ruiz",
  );
  assertEquals(res.ok, true);
});

Deno.test("parseName: first without last is rejected", () => {
  const res = parseName({ first_name: "Ana" }, "Ana", null);
  assertEquals(res.ok, false);
});

Deno.test("parseName: last without first is rejected", () => {
  const res = parseName({ last_name: "Ruiz" }, null, "Ruiz");
  assertEquals(res.ok, false);
});

Deno.test("parseName: blank half (whitespace-only, cleaned to null) is rejected", () => {
  const res = parseName({ first_name: "Ana", last_name: "   " }, "Ana", null);
  assertEquals(res.ok, false);
});

Deno.test("parseName: patches that don't touch the name pass through", () => {
  assertEquals(parseName({ birthday: "1990-04-02" }, null, null).ok, true);
  assertEquals(parseName({ profile_public: true }, null, null).ok, true);
  // Legacy single-field clients still allowed — they don't set first/last.
  assertEquals(parseName({ full_name: "Ana Ruiz" }, null, null).ok, true);
});

Deno.test("buildProfilePatch: name pair also refreshes full_name", () => {
  const res = buildProfilePatch(
    { first_name: "Ana", last_name: "Ruiz" },
    {
      firstName: "Ana",
      lastName: "Ruiz",
      fullName: "Ana Ruiz",
      sex: null,
      birthday: null,
      country: null,
      phone: null,
    },
  );
  assertEquals(res.ok, true);
  if (!res.ok) return;
  assertEquals(res.patch, {
    first_name: "Ana",
    last_name: "Ruiz",
    full_name: "Ana Ruiz",
  });
});

Deno.test("buildProfilePatch: privacy flags alone (MESITA-913)", () => {
  const res = buildProfilePatch(
    { profile_public: false, profile_show_stories: false },
    {
      firstName: null,
      lastName: null,
      fullName: null,
      sex: null,
      birthday: null,
      country: null,
      phone: null,
    },
  );
  assertEquals(res.ok, true);
  if (!res.ok) return;
  assertEquals(res.patch, {
    profile_public: false,
    profile_show_stories: false,
  });
});

const SUPABASE_URL = "https://abc.supabase.co";
const USER_ID = "11111111-1111-1111-1111-111111111111";

Deno.test("parseAvatarUrl: omitted leaves undefined", () => {
  const res = parseAvatarUrl(undefined, USER_ID, SUPABASE_URL);
  assertEquals(res.ok, true);
  if (!res.ok) return;
  assertEquals(res.avatarUrl, undefined);
});

Deno.test("parseAvatarUrl: null/empty clears", () => {
  assertEquals(parseAvatarUrl(null, USER_ID, SUPABASE_URL).ok, true);
  assertEquals(parseAvatarUrl("", USER_ID, SUPABASE_URL).ok, true);
  const cleared = parseAvatarUrl(null, USER_ID, SUPABASE_URL);
  if (!cleared.ok) return;
  assertEquals(cleared.avatarUrl, null);
});

Deno.test("parseAvatarUrl: accepts own consumer-avatars public URL", () => {
  const url =
    `${SUPABASE_URL}/storage/v1/object/public/consumer-avatars/${USER_ID}/1-a.jpg`;
  const res = parseAvatarUrl(url, USER_ID, SUPABASE_URL);
  assertEquals(res.ok, true);
  if (!res.ok) return;
  assertEquals(res.avatarUrl, url);
});

Deno.test("parseAvatarUrl: rejects foreign host or other user folder", () => {
  assertEquals(
    parseAvatarUrl("https://evil.example/pwn.jpg", USER_ID, SUPABASE_URL).ok,
    false,
  );
  assertEquals(
    parseAvatarUrl(
      `${SUPABASE_URL}/storage/v1/object/public/consumer-avatars/22222222-2222-2222-2222-222222222222/x.jpg`,
      USER_ID,
      SUPABASE_URL,
    ).ok,
    false,
  );
});

Deno.test("buildProfilePatch: avatar_url alone", () => {
  const url =
    `${SUPABASE_URL}/storage/v1/object/public/consumer-avatars/${USER_ID}/1-a.jpg`;
  const res = buildProfilePatch(
    { avatar_url: url },
    {
      firstName: null,
      lastName: null,
      fullName: null,
      sex: null,
      birthday: null,
      country: null,
      phone: null,
      avatarUrl: url,
    },
  );
  assertEquals(res.ok, true);
  if (!res.ok) return;
  assertEquals(res.patch, { avatar_url: url });
});
