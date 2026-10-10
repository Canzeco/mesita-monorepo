// The Twilio card must say WHICH thing is broken (MESITA-2097).
import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert";
import { twilioFailureDetail } from "./twilio-failure.ts";

const SRC = await Deno.readTextFile(new URL("./index.ts", import.meta.url));

// 2026-10-10, the card's red box, verbatim apart from the SID.
const SUSPENDED_MSG =
  "authentication failed, account ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx with status 4 is not active";

Deno.test("THE REGRESSION: a suspended account no longer reads like a bad key", () => {
  // Whatever code Twilio attaches, the words are the tell.
  for (const code of [20003, 20005, undefined]) {
    const body = { code, message: SUSPENDED_MSG, status: 401 };
    const line = twilioFailureDetail(body, 401, SUSPENDED_MSG);
    assert(line, `code ${code} must be explained`);
    assert(line.startsWith("Account not active"), line);
    assert(!line.startsWith("Key rejected"), line);
    assertStringIncludes(line, "Twilio Console");
    // Twilio's own words stay on the card as evidence.
    assertStringIncludes(line, SUSPENDED_MSG);
  }
});

Deno.test("the documented inactive codes win even without the words", () => {
  for (const code of [20005, 10001]) {
    const line = twilioFailureDetail(
      { code, message: "Unauthorized" },
      401,
      "x",
    );
    assert(line?.startsWith("Account not active"), String(line));
  }
});

Deno.test("a plain 20003 is a bad key", () => {
  const body = { code: 20003, message: "Authenticate", status: 401 };
  const line = twilioFailureDetail(body, 401, "Authenticate");
  assert(line?.startsWith("Key rejected"), String(line));
  assertStringIncludes(line!, "TWILIO_AUTH_TOKEN");
});

Deno.test("anything else falls back to Twilio's own line", () => {
  assertEquals(
    twilioFailureDetail(
      { code: 20429, message: "Too Many Requests" },
      429,
      "x",
    ),
    null,
  );
  assertEquals(twilioFailureDetail(null, 500, "x"), null);
});

Deno.test("the probe is wired: runProbe consults failDetail, Twilio supplies it", () => {
  assert(SRC.includes("failDetail: twilioFailureDetail"));
  assert(
    SRC.includes("failDetail?.(body, res.status, vendorLine) ?? vendorLine"),
  );
});
