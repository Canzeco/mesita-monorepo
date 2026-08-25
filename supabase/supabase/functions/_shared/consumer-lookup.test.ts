import { assertEquals } from "jsr:@std/assert";
import {
  candidateLabel,
  classifyConsumerLookup,
  consumerDisplayName,
  normalizeInstagramHandle,
  safeOrFilterValue,
  toConsumerSummary,
} from "./consumer-lookup.ts";

Deno.test("classify: uuid → id (lowercased)", () => {
  assertEquals(
    classifyConsumerLookup("A1B2C3D4-1111-2222-3333-444455556666"),
    { kind: "id", value: "a1b2c3d4-1111-2222-3333-444455556666" },
  );
});

Deno.test("classify: 8 digits → code, canonicalised", () => {
  assertEquals(classifyConsumerLookup("12345678"), {
    kind: "code",
    value: "1234-5678",
  });
  assertEquals(classifyConsumerLookup(" 1234-5678 "), {
    kind: "code",
    value: "1234-5678",
  });
});

Deno.test("classify: dialable numbers → phone in E.164", () => {
  assertEquals(classifyConsumerLookup("+52 55 1234 5678"), {
    kind: "phone",
    value: "+525512345678",
  });
  // 10 digits, no prefix — a Mexican mobile, not a consumer code.
  assertEquals(classifyConsumerLookup("5512345678"), {
    kind: "phone",
    value: "+5512345678",
  });
});

Deno.test("classify: a `+` rules out the code reading", () => {
  assertEquals(classifyConsumerLookup("+12345678"), {
    kind: "phone",
    value: "+12345678",
  });
});

Deno.test("classify: numeric junk resolves to nothing", () => {
  assertEquals(classifyConsumerLookup("12345"), null);
  assertEquals(classifyConsumerLookup("   "), null);
  assertEquals(classifyConsumerLookup(null), null);
});

Deno.test("classify: @handle and instagram URLs → handle", () => {
  assertEquals(classifyConsumerLookup("@Pato_Canseco"), {
    kind: "handle",
    value: "pato_canseco",
  });
  assertEquals(
    classifyConsumerLookup("https://www.instagram.com/mesita.ai/?hl=es"),
    { kind: "handle", value: "mesita.ai" },
  );
});

Deno.test("classify: a malformed @handle is refused, not searched", () => {
  assertEquals(classifyConsumerLookup("@no spaces allowed"), null);
});

Deno.test("classify: free text → text, whitespace collapsed", () => {
  assertEquals(classifyConsumerLookup("  Patricio   Canseco "), {
    kind: "text",
    value: "Patricio Canseco",
  });
});

Deno.test("normalizeInstagramHandle: strips @, URL and case", () => {
  assertEquals(normalizeInstagramHandle("@MESITA"), "mesita");
  assertEquals(normalizeInstagramHandle("instagram.com/mesita"), "mesita");
  assertEquals(normalizeInstagramHandle("not a handle"), null);
});

Deno.test("safeOrFilterValue: strips PostgREST-breaking punctuation", () => {
  assertEquals(
    safeOrFilterValue("Canseco, Patricio (Pato)"),
    "Canseco Patricio Pato",
  );
});

Deno.test("consumerDisplayName: falls back to the first/last pair", () => {
  assertEquals(
    consumerDisplayName({ full_name: "Ada Lovelace" }),
    "Ada Lovelace",
  );
  assertEquals(
    consumerDisplayName({ full_name: "  ", first_name: "Ada", last_name: "L" }),
    "Ada L",
  );
  assertEquals(consumerDisplayName({}), null);
});

Deno.test("toConsumerSummary: maps the row, blanks become null", () => {
  assertEquals(
    toConsumerSummary({
      id: "a1b2c3d4-1111-2222-3333-444455556666",
      code: "1234-5678",
      full_name: "Ada Lovelace",
      phone: "+525512345678",
      instagram_handle: "",
      instagram_followers_count: 4200,
      class_key: "diamond",
      class_origin: "invitation",
      class_granted_at: "2026-08-04T00:00:00Z",
      invitation_class_key: "diamond",
      invitation_granted_at: "2026-08-04T00:00:00Z",
    }),
    {
      id: "a1b2c3d4-1111-2222-3333-444455556666",
      code: "1234-5678",
      name: "Ada Lovelace",
      phone: "+525512345678",
      instagramHandle: null,
      followers: 4200,
      classKey: "diamond",
      classOrigin: "invitation",
      grantedAt: "2026-08-04T00:00:00Z",
      invitationClassKey: "diamond",
      invitationGrantedAt: "2026-08-04T00:00:00Z",
    },
  );
});

Deno.test("candidateLabel: name plus whatever identifies it", () => {
  assertEquals(
    candidateLabel({
      full_name: "Ada Lovelace",
      instagram_handle: "ada",
      code: "1234-5678",
    }),
    "Ada Lovelace (@ada · 1234-5678)",
  );
  assertEquals(candidateLabel({}), "Unnamed");
});
