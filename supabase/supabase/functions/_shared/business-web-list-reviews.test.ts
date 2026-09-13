// business-web-list-reviews must not leak visit_tickets.check_code to org
// viewers. check_code is the possession token for check.mesita.ai
// (verify_jwt=false); business-web-list-tickets deliberately omits it.

import { assert, assertStringIncludes } from "jsr:@std/assert@1";

const LIST_REVIEWS = new URL(
  "../business-web-list-reviews/index.ts",
  import.meta.url,
);
const LIST_TICKETS = new URL(
  "../business-web-list-tickets/index.ts",
  import.meta.url,
);

function codeOnly(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

Deno.test("business-web-list-reviews: check_code is editor+ only, like list-tickets omits it", async () => {
  const reviews = codeOnly(await Deno.readTextFile(LIST_REVIEWS));
  const tickets = await Deno.readTextFile(LIST_TICKETS);

  assert(
    !tickets.includes("check_code"),
    "business-web-list-tickets must not select check_code",
  );

  assertStringIncludes(reviews, "mayLinkVisit");
  assertStringIncludes(reviews, 'roleRes.role === "owner"');
  assertStringIncludes(reviews, 'roleRes.role === "editor"');
  assertStringIncludes(
    reviews,
    "ticket:visit_tickets(check_code)",
    "editors may join check_code to build visitUrl",
  );

  // The join must be conditional — a bare select of check_code for every caller
  // would hand viewers a possession token.
  assert(
    reviews.includes("mayLinkVisit ?"),
    "check_code join must be gated behind mayLinkVisit",
  );
  assert(
    reviews.indexOf("requireOrgRole") < reviews.indexOf("mayLinkVisit"),
    "role must be resolved before deciding whether check_code is readable",
  );
});
