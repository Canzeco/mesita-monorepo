import { assertEquals } from "jsr:@std/assert@1";
import { approxAge, levelPatch, shownSex, socialLabel, socialLevel, socialLock } from "./social-level.ts";

const NOW = new Date("2026-11-24T12:00:00Z");
const open = { social_private: false, instagram_verified_at: "2026-01-01", instagram_handle_shown: true };

Deno.test("minors and guests with no year are private whatever they chose (MESITA-4850)", () => {
  assertEquals(socialLevel({ ...open, birth_year: 2010 }, NOW), "private");
  // 2008 may still be 17 today: the year alone does not prove 18.
  assertEquals(socialLevel({ ...open, birth_year: 2008 }, NOW), "private");
  assertEquals(socialLevel({ ...open, birth_year: null }, NOW), "private");
  assertEquals(socialLevel({ ...open, birth_year: 2007 }, NOW), "instagram");
  assertEquals([socialLock(2010, NOW), socialLock(null, NOW), socialLock(2007, NOW)], ["minor", "no_birth_year", null]);
});

Deno.test("an adult's level", () => {
  assertEquals(socialLevel({ ...open, birth_year: 1990, social_private: true }, NOW), "private");
  assertEquals(socialLevel({ ...open, birth_year: 1990, instagram_handle_shown: null }, NOW), "public");
  assertEquals(socialLevel({ ...open, birth_year: 1990, instagram_verified_at: null }, NOW), "public");
  assertEquals(levelPatch("private"), { social_private: true, instagram_handle_shown: false });
});

Deno.test("a minor's age and sex are never worded", () => {
  assertEquals(approxAge(2008, NOW), null);
  assertEquals(shownSex(2008, "female", NOW), null);
  assertEquals(socialLabel(2010, "female", NOW), "Guest");
  assertEquals(socialLabel(2001, "female", NOW), "Woman, mid 20s");
  assertEquals(socialLabel(1998, "male", NOW), "Man, late 20s");
  assertEquals(socialLabel(1995, null, NOW), "Guest, early 30s");
});
