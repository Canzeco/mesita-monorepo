// MESITA-3304: the proof token is the only key the staff page has.
import { assert, assertEquals } from "jsr:@std/assert@1";
import { isProofToken, mintProofToken, PROOF_ORIGIN, proofUrl } from "./proof.ts";

Deno.test("mintProofToken: 22 base64url characters, never the same twice", () => {
  const seen = new Set<string>();
  for (let i = 0; i < 200; i++) {
    const t = mintProofToken();
    assert(isProofToken(t), t);
    seen.add(t);
  }
  assertEquals(seen.size, 200);
});

Deno.test("isProofToken: refuses anything the column check would refuse", () => {
  for (const bad of [null, undefined, 1, "", "short", "a".repeat(21), "a".repeat(23), "aaaaaaaaaaaaaaaaaaaaa=", "aaaaaaaaaaaaaaaaaaaa+/"]) {
    assertEquals(isProofToken(bad), false, String(bad));
  }
});

Deno.test("proofUrl: visit.mesita.ai unless VISIT_WEB_URL overrides it", () => {
  assertEquals(proofUrl("T", () => undefined), `${PROOF_ORIGIN}/proof/T`);
  assertEquals(proofUrl("T", () => "https://visit-test.example.com/ "), "https://visit-test.example.com/proof/T");
  assertEquals(proofUrl("T", () => "  "), `${PROOF_ORIGIN}/proof/T`);
});
