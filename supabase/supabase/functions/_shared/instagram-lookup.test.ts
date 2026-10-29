import { assertEquals } from "jsr:@std/assert@1";
import { profileFromScrape } from "./instagram-lookup.ts";

// What a scrape turns into before anything is stored on the account.

Deno.test("profileFromScrape: the scraped account's followers and photo", () => {
  assertEquals(
    profileFromScrape(
      {
        username: "Mesita.MX",
        followersCount: 1234.9,
        profilePicUrlHD: "https://cdn.example/hd.jpg",
        fullName: "Mesita",
      },
      "mesita.mx",
    ),
    {
      username: "mesita.mx",
      profilePictureUrl: "https://cdn.example/hd.jpg",
      followerCount: 1234,
    },
  );
});

Deno.test("profileFromScrape: another account is not this one", () => {
  assertEquals(
    profileFromScrape({
      username: "someone_else",
      followersCount: 10,
      fullName: "x",
    }, "mesita.mx"),
    null,
  );
});

Deno.test("profileFromScrape: an empty or error item finds nothing", () => {
  assertEquals(profileFromScrape(undefined, "mesita.mx"), null);
  assertEquals(
    profileFromScrape(
      { username: "mesita.mx", error: "not_found" },
      "mesita.mx",
    ),
    null,
  );
  assertEquals(profileFromScrape({ username: "mesita.mx" }, "mesita.mx"), null);
});

Deno.test("profileFromScrape: no count reads as zero, never negative", () => {
  assertEquals(
    profileFromScrape({ username: "a", fullName: "A", followersCount: -5 }, "a")
      ?.followerCount,
    0,
  );
});
