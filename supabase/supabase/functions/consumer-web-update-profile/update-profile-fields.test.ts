import { assertEquals } from "jsr:@std/assert";
import { buildProfilePatch, parseName } from "./update-profile-fields.ts";

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
