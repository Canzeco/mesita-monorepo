import { assertEquals } from "jsr:@std/assert@1";
import { normalizeVerificationConfig } from "./verification-config.ts";

Deno.test("normalizeVerificationConfig: null/undefined blob defaults match the old scalar-column defaults", () => {
  assertEquals(normalizeVerificationConfig(null), {
    createPlacesAsVerified: false,
    autoVerifyAiCall: true,
    autoVerifyAiEmail: true,
  });
  assertEquals(normalizeVerificationConfig(undefined), {
    createPlacesAsVerified: false,
    autoVerifyAiCall: true,
    autoVerifyAiEmail: true,
  });
  assertEquals(normalizeVerificationConfig({}), {
    createPlacesAsVerified: false,
    autoVerifyAiCall: true,
    autoVerifyAiEmail: true,
  });
});

Deno.test("normalizeVerificationConfig: createPlacesAsVerified only turns on when explicitly true", () => {
  assertEquals(normalizeVerificationConfig({ createPlacesAsVerified: true }).createPlacesAsVerified, true);
  assertEquals(normalizeVerificationConfig({ createPlacesAsVerified: false }).createPlacesAsVerified, false);
  assertEquals(normalizeVerificationConfig({ createPlacesAsVerified: "true" }).createPlacesAsVerified, false);
  assertEquals(normalizeVerificationConfig({ createPlacesAsVerified: null }).createPlacesAsVerified, false);
});

Deno.test("normalizeVerificationConfig: autoVerifyAiCall/autoVerifyAiEmail only turn off when explicitly false — a security-relevant default", () => {
  assertEquals(normalizeVerificationConfig({ autoVerifyAiCall: false }).autoVerifyAiCall, false);
  assertEquals(normalizeVerificationConfig({ autoVerifyAiCall: true }).autoVerifyAiCall, true);
  assertEquals(normalizeVerificationConfig({ autoVerifyAiCall: null }).autoVerifyAiCall, true);
  assertEquals(normalizeVerificationConfig({ autoVerifyAiCall: "off" }).autoVerifyAiCall, true);

  assertEquals(normalizeVerificationConfig({ autoVerifyAiEmail: false }).autoVerifyAiEmail, false);
  assertEquals(normalizeVerificationConfig({ autoVerifyAiEmail: true }).autoVerifyAiEmail, true);
  assertEquals(normalizeVerificationConfig({ autoVerifyAiEmail: null }).autoVerifyAiEmail, true);
});

Deno.test("normalizeVerificationConfig: a garbage/non-object blob falls back to defaults rather than throwing", () => {
  assertEquals(normalizeVerificationConfig("not an object"), {
    createPlacesAsVerified: false,
    autoVerifyAiCall: true,
    autoVerifyAiEmail: true,
  });
  assertEquals(normalizeVerificationConfig(42), {
    createPlacesAsVerified: false,
    autoVerifyAiCall: true,
    autoVerifyAiEmail: true,
  });
  assertEquals(normalizeVerificationConfig([1, 2, 3]).createPlacesAsVerified, false);
});

Deno.test("normalizeVerificationConfig: extra unknown keys are silently dropped, not carried through", () => {
  const out = normalizeVerificationConfig({
    createPlacesAsVerified: true,
    autoVerifyVideo: true, // retired field — must not resurrect
    somethingElse: "x",
  });
  assertEquals(out, {
    createPlacesAsVerified: true,
    autoVerifyAiCall: true,
    autoVerifyAiEmail: true,
  });
  assertEquals(Object.keys(out).sort(), [
    "autoVerifyAiCall",
    "autoVerifyAiEmail",
    "createPlacesAsVerified",
  ]);
});
