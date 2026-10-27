import assert from "node:assert/strict";
import test from "node:test";
import { EMBEDDING_DIMS, embeddingFacts, embeddingFields, vectorLiteral, writtenSubject } from "./embedding.ts";

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
  assert.equal(embeddingFields([0.1], [0.2], "text"), null);
  const full = Array.from({ length: EMBEDDING_DIMS }, () => 0.1);
  const fields = embeddingFields(full, null, "text");
  assert.equal(fields?.embedding_source_text, "text");
  assert.equal("name_embedding" in (fields ?? {}), false);
});

test("the vectors read the profile as written: a saved name, address and description win (MESITA-2801)", async () => {
  const subject = writtenSubject({
    google_name: "Strana",
    name: "Strana Zona Hotelera",
    zone: "Zona Hotelera",
    city: "Puerto Vallarta",
    address: "Saved address 1",
    description: "The saved presentation.",
  });
  if (!subject) throw new Error("a named patch has a subject");
  assert.equal(subject.name, "Strana Zona Hotelera");
  assert.match(subject.facts, /^Name: Strana Zona Hotelera$/m);
  assert.match(subject.facts, /^Address: Saved address 1$/m);
  assert.match(subject.facts, /^About: The saved presentation\.$/m);
  // The stored text is the text the vector embeds.
  const fields = embeddingFields(new Array(EMBEDDING_DIMS).fill(0), null, subject.facts);
  assert.equal(fields?.embedding_source_text, subject.facts);
});

test("the vector name is the one the profile shows: the Mesita name, else Google's (MESITA-2828)", () => {
  assert.equal(writtenSubject({ name: "A", google_name: "C" })?.name, "A");
  assert.equal(writtenSubject({ name: " ", google_name: "C" })?.name, "C");
  assert.equal(writtenSubject({ google_name: "C" })?.name, "C");
  assert.equal(writtenSubject({ description: "no name" }), null);
});
