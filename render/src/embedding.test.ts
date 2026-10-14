import assert from "node:assert/strict";
import test from "node:test";
import { EMBEDDING_DIMS, embeddingFacts, embeddingFields, vectorLiteral } from "./embedding.ts";

test("facts keep name, place, and about, and skip an empty about", () => {
  assert.equal(
    embeddingFacts({
      name: "Casa Luminar",
      zone: "Condesa",
      city: "CDMX",
      address: "Av. Ámsterdam 1",
      description: "Cocina de mercado",
    }),
    "Name: Casa Luminar\nLocation: Condesa, CDMX\nAddress: Av. Ámsterdam 1\nAbout: Cocina de mercado",
  );
});

test("a vector is the pgvector literal", () => {
  assert.equal(vectorLiteral([0.1, 0.2]), "[0.100000,0.200000]");
});

test("a short vector is left off the place", () => {
  assert.equal(embeddingFields([0.1], [0.2], "a", "b", "text"), null);
  const full = Array.from({ length: EMBEDDING_DIMS }, () => 0.1);
  const fields = embeddingFields(full, null, "hash", "name", "text");
  assert.equal(fields?.embedding_source_text, "text");
  assert.equal("name_embedding" in (fields ?? {}), false);
});
