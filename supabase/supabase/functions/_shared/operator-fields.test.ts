// Operator-owned fields (MESITA-2829): the mark that keeps an operator's name,
// Presentation or tags through every Enrich. Guards against the one failure
// that matters — a run quietly writing over what a person typed.

import { assertEquals } from "jsr:@std/assert@1";
import {
  operatorFieldsInPatch,
  readOperatorFields,
  stripOperatorFields,
  withOperatorFields,
} from "./operator-fields.ts";

Deno.test("readOperatorFields: only the three Basics fields, and junk reads as none", () => {
  assertEquals(readOperatorFields({ operator_fields: ["name", "hours", "tags"] }), ["name", "tags"]);
  assertEquals(readOperatorFields({ operator_fields: "name" }), []);
  assertEquals(readOperatorFields(null), []);
  assertEquals(readOperatorFields({ pins: {} }), []);
});

Deno.test("operatorFieldsInPatch: a typed value is owned, a clearing is not", () => {
  assertEquals(
    operatorFieldsInPatch({ name: "La Cocina", description: "  ", tags: [], hours: {} }),
    ["name"],
  );
  assertEquals(operatorFieldsInPatch({ name: null, tags: ["cozy"] }), ["tags"]);
  assertEquals(operatorFieldsInPatch({ phone: "+52" }), []);
});

Deno.test("stripOperatorFields: an Enrich write skips the owned columns and reports them", () => {
  const { update, skipped } = stripOperatorFields(
    { name: "Machine Name", description: "Machine prose", tags: ["a"], address: "X" },
    ["name", "tags"],
  );
  assertEquals(update, { description: "Machine prose", address: "X" });
  assertEquals(skipped, ["name", "tags"]);
  // A column the run does not carry is not skipped.
  assertEquals(stripOperatorFields({ address: "X" }, ["name"]).skipped, []);
});

Deno.test("withOperatorFields: carried through a rebuilt bag; none ⇒ no key", () => {
  const rebuilt = { synthesis: { ok: true }, operator_fields: ["name"] };
  assertEquals(withOperatorFields(rebuilt, ["description", "name"]), {
    synthesis: { ok: true },
    operator_fields: ["name", "description"],
  });
  assertEquals(withOperatorFields(rebuilt, []), { synthesis: { ok: true } });
});
