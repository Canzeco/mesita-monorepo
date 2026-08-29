import { assertEquals } from "jsr:@std/assert@1";
import { activeWritePatch } from "./place-active.ts";
import { validateProfilePatch } from "./place-doc.ts";

Deno.test("Active on writes OPERATIONAL and never unlists", () => {
  assertEquals(activeWritePatch(true, "active"), { business_status: "OPERATIONAL" });
  assertEquals(activeWritePatch(true, "lead"), { business_status: "OPERATIONAL" });
  assertEquals(activeWritePatch(true, "paused"), { business_status: "OPERATIONAL" });
});

Deno.test("Active off writes CLOSED_PERMANENTLY and unlists a listed place", () => {
  assertEquals(activeWritePatch(false, "active"), {
    business_status: "CLOSED_PERMANENTLY",
    status: "paused",
  });
  assertEquals(activeWritePatch(false, "lead"), {
    business_status: "CLOSED_PERMANENTLY",
    status: "paused",
  });
});

Deno.test("Active off on an already-unlisted place does not rewrite status", () => {
  assertEquals(activeWritePatch(false, "paused"), {
    business_status: "CLOSED_PERMANENTLY",
  });
  assertEquals(activeWritePatch(false, "archived"), {
    business_status: "CLOSED_PERMANENTLY",
  });
  assertEquals(activeWritePatch(false, null), {
    business_status: "CLOSED_PERMANENTLY",
  });
});

Deno.test("Active off patch is a valid profiles write (business_status + status)", () => {
  const patch = activeWritePatch(false, "active");
  const validated = validateProfilePatch({
    ...patch,
    business_status_at: "2026-08-27T00:00:00.000Z",
  });
  assertEquals(validated.ok, true);
});
