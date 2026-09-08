// business-web-verify-place — the rules that survive the mock (MESITA-1664).
//
// The code is fake on purpose and will be replaced by a real OTP. Everything
// AROUND it is not: who may verify, where the holder is read from, what gets
// written, and the promise that nothing is sent to anyone. Those are the parts
// a later swap must not quietly drop, and none of them is checked by a type.
//
// Source-reading, because the handler needs a live Supabase env to run and a
// mock of that env would assert the mock, not the function.
import { assert, assertEquals } from "jsr:@std/assert@1";

const SRC = Deno.readTextFileSync(
  new URL("./index.ts", import.meta.url).pathname,
);

/** Comments here describe the guards in prose and would satisfy a naive
 *  substring search on their own. Rules read code only. */
function codeOnly(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}
const CODE = codeOnly(SRC);

Deno.test("the code is compared on the server, never handed to the client", () => {
  assert(
    /const MOCK_VERIFICATION_CODE = "123456"/.test(CODE),
    "the mock lives in one named constant so removing it is one grep",
  );
  assert(
    /code !== MOCK_VERIFICATION_CODE/.test(CODE),
    "the comparison must happen in the handler",
  );
  // A mock the browser could evaluate would teach the console a shape the
  // real OTP cannot keep, and swapping it in later would widen access
  // silently. The constant must never travel out in a response.
  assert(
    !/json\([^)]*MOCK_VERIFICATION_CODE/.test(CODE),
    "the expected code must never be returned to the caller",
  );
});

Deno.test("verifying is owner-only, like the claim it completes", () => {
  assert(
    /requireOrgRole\(\s*admin,\s*authRes\.user,\s*organizationId,\s*\[\s*"owner",?\s*\]/
      .test(CODE),
    "must gate on owner of the holding organization",
  );
});

Deno.test("the holder comes from the place, not from the caller's body", () => {
  // Trusting an organizationId off the request would let an owner of org A
  // verify a place held by org B: the role check would pass against the org
  // they named rather than the one that actually holds it.
  assert(
    /\.from\("places"\)[\s\S]{0,120}\.eq\("id",\s*placeId\)/.test(CODE),
    "must read the place row to learn its holder",
  );
  assert(
    !/body\.organizationId/.test(CODE),
    "must not accept an organizationId from the request body",
  );
});

Deno.test("an unheld place is an ordering error, not a permission one", () => {
  assert(/"not_held"/.test(CODE), "must answer a distinct not_held code");
});

Deno.test("it writes one approved row, attributed to the mock", () => {
  assert(/\.from\("place_verifications"\)[\s\S]{0,80}\.insert\(/.test(CODE));
  assert(/method:\s*"mock_code"/.test(CODE), "method must name the mock");
  assert(/state:\s*"approved"/.test(CODE), "Verified derives from approved");
  // manual_contact would tell an operator reading the queue that a human
  // made contact when nobody did.
  assert(
    !/"manual_contact"/.test(CODE),
    "must not borrow a method that claims human contact",
  );
});

Deno.test("already-verified is a success, checked before the code", () => {
  const existingAt = CODE.indexOf('.eq("state", "approved")');
  const compareAt = CODE.indexOf("code !== MOCK_VERIFICATION_CODE");
  assert(existingAt > -1 && compareAt > -1);
  assert(
    existingAt < compareAt,
    "Verified never lapses, so a typo on an already-verified place must still report the truth",
  );
  assert(/alreadyVerified/.test(CODE));
});

Deno.test("nothing is sent to anybody", () => {
  // Pato: "don't send emails nor make phone calls, you just need to input
  // shit." The absence of a delivery path is the feature.
  for (const forbidden of ["otp.ts", "resend", "twilio", "sendEmail", "sendSms"]) {
    assertEquals(
      CODE.includes(forbidden),
      false,
      `must not reach a delivery path (${forbidden})`,
    );
  }
});
