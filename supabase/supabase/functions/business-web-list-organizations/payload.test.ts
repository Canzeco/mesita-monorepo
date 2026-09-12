// Source contract: the rail's places ride this payload, but `name` and
// `photos` live on place_profiles, not on places (MESITA-1781). Selecting
// them off `places` 42703s the whole Organization screen, which hides the
// create form behind "Couldn't load your organizations".
import { assert, assertEquals } from "jsr:@std/assert";

const SRC = await Deno.readTextFile(
  new URL("./index.ts", import.meta.url),
);

const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

Deno.test("the rail embed reads name and photos from place_profiles", () => {
  assert(
    CODE.includes("place_profiles!inner(name, photos)"),
    "name/photos must come from the generated profile column, not places",
  );
});

Deno.test("places is not asked for name or photos as own columns", () => {
  // The MESITA-1779 select that broke prod. A comment may still name it;
  // CODE has the prose stripped so the explanation cannot satisfy this.
  assertEquals(
    /select\(\s*["']id,\s*organization_id,\s*name,\s*photos["']\s*\)/.test(
      CODE,
    ),
    false,
  );
  assert(
    !/\.order\(\s*["']name["']/.test(CODE),
    "ordering places.name is the same 42703; sort the rail rows in memory",
  );
});

Deno.test("photos are narrowed to ONE url, never the array", () => {
  assert(SRC.includes("photoUrl:"), "payload must carry photoUrl");
  assert(
    !/\bphotos:\s*p\.photos/.test(SRC),
    "payload must not ship the array",
  );
});
