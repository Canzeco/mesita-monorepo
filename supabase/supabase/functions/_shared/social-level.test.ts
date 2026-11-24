import { assertEquals } from "jsr:@std/assert@1";
import { levelPatch, shownAge, shownSex, socialBlocked, socialLevel, socialLock } from "./social-level.ts";

const NOW = new Date("2026-11-24T12:00:00Z");
const open = { social_private: false, instagram_verified_at: "2026-01-01", instagram_proved_at: "2026-01-01", instagram_handle_shown: true };

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
  // A typed username proves nothing (MESITA-4856).
  assertEquals(socialLevel({ ...open, birth_year: 1990, instagram_proved_at: null }, NOW), "public");
  assertEquals(levelPatch("private"), { social_private: true, instagram_handle_shown: false });
});

Deno.test("a minor's age and sex are never shown", () => {
  assertEquals(shownAge(2008, NOW), null);
  assertEquals(shownSex(2008, "female", NOW), null);
  assertEquals(shownSex(2008, "other", NOW), null);
  assertEquals([shownSex(1990, "other", NOW), shownSex(1990, "x", NOW)], ["other", null]);
});

Deno.test("a private member, a minor or one with no year sees nobody (MESITA-4854)", () => {
  assertEquals(socialBlocked({ ...open, birth_year: 1990, social_private: true }, NOW), "private");
  assertEquals(socialBlocked({ ...open, birth_year: 2010 }, NOW), "minor");
  assertEquals(socialBlocked({ ...open, birth_year: null }, NOW), "no_birth_year");
  assertEquals(socialBlocked(null, NOW), "no_birth_year");
  assertEquals(socialBlocked({ ...open, birth_year: 1990 }, NOW), null);
  assertEquals(socialBlocked({ ...open, birth_year: 1990, instagram_verified_at: null }, NOW), null);
});
