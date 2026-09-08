// business-web-verify-place — the rules that survive the missing proof.
//
// There is no challenge yet: Verify is one click, and the real phone OTP will
// arrive as its own step in FRONT of this call. Everything AROUND the missing
// proof is already real: who may verify, where the holder is read from, what
// gets written, and the promise that nothing is sent to anyone. Those are the
// parts the later swap must not quietly drop, and none is checked by a type.
//
// Source-reading, because the handler needs a live Supabase env to run and a
// mock of that env would assert the mock, not the function.
import { assert, assertEquals } from "jsr:@std/assert@1";

const SRC = Deno.readTextFileSync(
  new URL("./index.ts", import.meta.url).pathname,
);
// The insert itself moved to the shared writer (MESITA-1690) so this EF, the
// claim EF, and the admin attestation EF cannot each hand-roll it and drift.
// A guard about what gets WRITTEN has to read both files now.
const SHARED_SRC = Deno.readTextFileSync(
  new URL("../_shared/place-verification.ts", import.meta.url).pathname,
);

/** Comments here describe the guards in prose and would satisfy a naive
 *  substring search on their own. Rules read code only. */
function codeOnly(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}
const CODE = codeOnly(SRC);
const SHARED_CODE = codeOnly(SHARED_SRC);

Deno.test("no code is asked for, and none is checked", () => {
  // MESITA-1664 shipped a mock 123456 the caller had to type. It proved
  // nothing and cost a step, so it is gone — including the constant, so a
  // later reader cannot mistake a dead literal for a live secret.
  assert(!/MOCK_VERIFICATION_CODE/.test(CODE), "the mock constant is gone");
  assert(!/"123456"/.test(CODE), "no code literal survives");
  assert(
    !/body\.code|formData|\bcode\s*!==/.test(CODE),
    "the handler must not read or compare a code",
  );
  // The 409 for an unheld place still answers `code: "not_held"` — that is a
  // machine-readable error name, not a secret, so the guard above is written
  // against reads and comparisons rather than the word itself.
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
  assert(
    /writeApprovedVerification\(/.test(CODE),
    "must write through the shared writer, not a second hand-rolled insert",
  );
  // `mock_code` is the enum value for "verified without real proof" — it
  // stays honest now that the proof is a bare click, and the admin queue can
  // still tell these apart from a human attestation.
  assert(/method:\s*"mock_code"/.test(CODE), "method must name the mock");
  assert(
    /\.from\("place_verifications"\)[\s\S]{0,80}\.insert\(/.test(SHARED_CODE),
    "the shared writer must be the one place the insert actually happens",
  );
  assert(
    /state:\s*"approved"/.test(SHARED_CODE),
    "Verified derives from approved",
  );
  // manual_contact would tell an operator reading the queue that a human
  // made contact when nobody did.
  assert(
    !/"manual_contact"/.test(CODE),
    "must not borrow a method that claims human contact",
  );
});

// MESITA-1690: the regression itself. `decided_via`'s check constraint only
// allows 'auto' | 'admin' — writing the METHOD name into it 500'd on
// every real Verify click. Pinned here so the copy-paste can't recur.
Deno.test("decided_via is 'auto', never the method's own name", () => {
  assert(
    /decidedVia:\s*"auto"/.test(CODE),
    "this EF's decision is automatic, not an admin's attestation",
  );
  assert(
    !/decided_via:\s*"mock_code"/.test(CODE) &&
      !/decidedVia:\s*"mock_code"/.test(CODE),
    "decided_via must never be handed the method's own value",
  );
});

Deno.test("already-verified is a success, not a duplicate row", () => {
  // Verified never lapses (MESITA-1320). The idempotence check lives in the
  // shared writer, which is also the only place the insert happens, so this
  // EF must not re-check it and must report what the writer returned.
  assert(
    /\.eq\("state",\s*"approved"\)/.test(SHARED_CODE),
    "the shared writer looks for an existing approved row",
  );
  assert(
    !/\.from\("place_verifications"\)/.test(CODE),
    "this EF must not query place_verifications itself",
  );
  assert(/alreadyVerified:\s*result\.alreadyVerified/.test(CODE));
});

Deno.test("nothing is sent to anybody", () => {
  // Pato: "don't send emails nor make phone calls." The absence of a
  // delivery path is the feature until the real phone step is built.
  for (
    const forbidden of ["otp.ts", "resend", "twilio", "sendEmail", "sendSms"]
  ) {
    assertEquals(
      CODE.includes(forbidden),
      false,
      `must not reach a delivery path (${forbidden})`,
    );
  }
});
