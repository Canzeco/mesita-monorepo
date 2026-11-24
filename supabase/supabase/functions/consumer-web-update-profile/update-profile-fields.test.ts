import { assertEquals } from "jsr:@std/assert";
import {
  buildProfilePatch,
  parseAvatarUrl,
  parseBirthYear,
  privacyRefusal,
  parseFollowersEmulated,
  parseName,
  removedFieldResponse,
} from "./update-profile-fields.ts";

// Each half of the name is written independently (MESITA-1806): onboarding
// sends the first name, the reservation sheet sends the last. What the EF
// still refuses is a half sent BLANK — that would leave a consumer no place
// can be told to expect.

Deno.test("parseName: both halves present", () => {
  const res = parseName(
    { first_name: "Ana", last_name: "Ruiz" },
    "Ana",
    "Ruiz",
  );
  assertEquals(res.ok, true);
});

Deno.test("parseName: first alone is accepted (the onboarding write)", () => {
  assertEquals(parseName({ first_name: "Ana" }, "Ana", null).ok, true);
});

Deno.test("parseName: last alone is accepted (the reservation-sheet write)", () => {
  assertEquals(parseName({ last_name: "Ruiz" }, null, "Ruiz").ok, true);
});

Deno.test("parseName: a half sent blank is still rejected", () => {
  // Whitespace-only, cleaned to null by `clean` before it reaches here.
  assertEquals(parseName({ first_name: "Ana", last_name: "   " }, "Ana", null).ok, false);
  assertEquals(parseName({ first_name: "" }, null, "Ruiz").ok, false);
  assertEquals(parseName({ last_name: "" }, "Ana", null).ok, false);
});

Deno.test("parseName: patches that don't touch the name pass through", () => {
  assertEquals(parseName({ birthday: "1990-04-02" }, null, null).ok, true);
  assertEquals(parseName({ avatar_url: null }, null, null).ok, true);
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

Deno.test("buildProfilePatch: an empty body is nothing to update", () => {
  const res = buildProfilePatch(
    {},
    {
      firstName: null,
      lastName: null,
      fullName: null,
      sex: null,
      birthday: null,
    },
  );
  assertEquals(res.ok, false);
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
      avatarUrl: url,
    },
  );
  assertEquals(res.ok, true);
  if (!res.ok) return;
  assertEquals(res.patch, { avatar_url: url });
});

const NO_FIELDS = {
  firstName: null,
  lastName: null,
  fullName: null,
  sex: null,
  birthday: null,
};

Deno.test("buildProfilePatch: the Instagram photo switch is written alone (MESITA-2585)", () => {
  const off = buildProfilePatch({ use_instagram_photo: false }, NO_FIELDS);
  assertEquals(off.ok, true);
  if (off.ok) assertEquals(off.patch, { use_instagram_photo: false });
  const on = buildProfilePatch({ use_instagram_photo: true }, NO_FIELDS);
  assertEquals(on.ok, true);
  if (on.ok) assertEquals(on.patch, { use_instagram_photo: true });
});

Deno.test("buildProfilePatch: a non-boolean Instagram photo switch is a 400", () => {
  const res = buildProfilePatch(
    { use_instagram_photo: "no" as unknown as boolean },
    NO_FIELDS,
  );
  assertEquals(res.ok, false);
});

// MESITA-4302: year of birth is the age source; the floor is by year alone.
Deno.test("parseBirthYear: the 14-year floor counts years only", () => {
  const now = new Date("2026-11-18T00:00:00Z");
  assertEquals(parseBirthYear(2012, now).ok, true);
  assertEquals(parseBirthYear("2012", now).ok, true);
  assertEquals(parseBirthYear(2013, now).ok, false);
  assertEquals(parseBirthYear(2027, now).ok, false);
  assertEquals(parseBirthYear(1899, now).ok, false);
  assertEquals(parseBirthYear(1990.5, now).ok, false);
  assertEquals(parseBirthYear("abc", now).ok, false);
  const none = parseBirthYear(undefined, now);
  assertEquals(none.ok && none.birthYear, null);
});

Deno.test("buildProfilePatch writes birth_year only when given", () => {
  const base = {
    firstName: null,
    lastName: null,
    fullName: null,
    sex: null,
    birthday: null,
  };
  const without = buildProfilePatch({}, base);
  assertEquals(without.ok && "birth_year" in without.patch, false);
  const withYear = buildProfilePatch({ birth_year: 1990 }, { ...base, birthYear: 1990 });
  assertEquals(withYear.ok && withYear.patch.birth_year, 1990);
});

// MESITA-4662: the follower emulator changes the Class, so it writes only in
// Stripe test mode; Reset to real (null) always works.
Deno.test("parseFollowersEmulated: live mode refuses a number, 403 emulator_live", async () => {
  const res = parseFollowersEmulated(10_000, false);
  assertEquals(res.ok, false);
  if (res.ok) return;
  assertEquals(res.response.status, 403);
  assertEquals((await res.response.json()).code, "emulator_live");
});

Deno.test("parseFollowersEmulated: null (Reset to real) passes in either mode; absent writes nothing", () => {
  assertEquals(parseFollowersEmulated(null, false), { ok: true, followersEmulated: null });
  assertEquals(parseFollowersEmulated(null, true), { ok: true, followersEmulated: null });
  assertEquals(parseFollowersEmulated(undefined, false), { ok: true, followersEmulated: undefined });
});

Deno.test("parseFollowersEmulated: test mode takes a whole number 0..100,000,000", () => {
  assertEquals(parseFollowersEmulated(0, true), { ok: true, followersEmulated: 0 });
  assertEquals(parseFollowersEmulated(5001, true), { ok: true, followersEmulated: 5001 });
  assertEquals(parseFollowersEmulated(100_000_000, true), { ok: true, followersEmulated: 100_000_000 });
  for (const bad of [-1, 100_000_001, 1.5, "5001", true, Number.NaN]) {
    const res = parseFollowersEmulated(bad, true);
    assertEquals(res.ok, false, String(bad));
    if (!res.ok) assertEquals(res.response.status, 400);
  }
});

Deno.test("buildProfilePatch: the emulated count is written alone, null included", () => {
  const fields = { firstName: null, lastName: null, fullName: null, sex: null, birthday: null };
  const set = buildProfilePatch({ instagram_followers_emulated: 5001 }, { ...fields, followersEmulated: 5001 });
  assertEquals(set.ok && set.patch, { instagram_followers_emulated: 5001 });
  const reset = buildProfilePatch({ instagram_followers_emulated: null }, { ...fields, followersEmulated: null });
  assertEquals(reset.ok && reset.patch, { instagram_followers_emulated: null });
});

// MESITA-4690: Public profile was removed. Any value of appear_anonymous gets
// one 400 before any other check or write; a body without it passes through.
Deno.test("removedFieldResponse: appear_anonymous is a 400 field_removed, whatever its value", async () => {
  for (const v of [true, false, null]) {
    const res = removedFieldResponse({ appear_anonymous: v, first_name: "Ana" });
    assertEquals(res?.status, 400);
    const body = await res!.json();
    assertEquals(body.ok, false);
    assertEquals(body.code, "field_removed");
  }
  assertEquals(removedFieldResponse({ first_name: "Ana" }), null);
  assertEquals(removedFieldResponse(null), null);
});

// MESITA-4850: a minor's lock cannot be written around.
Deno.test("privacyRefusal: a minor cannot open the profile or change the year", async () => {
  const now = new Date("2026-11-24T12:00:00Z");
  const minor = { birth_year: 2010, social_private: false };
  const adult = { ...minor, birth_year: 1990 };
  const code = async (r: Response | null) => r ? (await r.json()).code ?? r.status : null;
  assertEquals(await code(privacyRefusal({ social_level: "public" }, minor, undefined, now)), "minor_private");
  assertEquals(await code(privacyRefusal({ birth_year: 1990 }, minor, 1990, now)), "birth_year_locked");
  assertEquals(await code(privacyRefusal({ birth_year: null }, minor, null, now)), "birth_year_locked");
  assertEquals(await code(privacyRefusal({ social_level: "public", birth_year: 2010 }, minor, 2010, now)), "minor_private");
  assertEquals(privacyRefusal({ social_level: "private", birth_year: 2010 }, minor, 2010, now), null);
  assertEquals(privacyRefusal({ social_level: "public" }, adult, undefined, now), null);
  assertEquals(await code(privacyRefusal({ social_level: "instagram" }, adult, undefined, now)), 400);
  assertEquals(await code(privacyRefusal({ social_level: "public" }, { ...adult, birth_year: null }, undefined, now)), "birth_year_needed");
  assertEquals(await code(privacyRefusal({ social_level: "open" }, adult, undefined, now)), 400);
});
