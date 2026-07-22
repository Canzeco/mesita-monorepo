// deno test supabase/functions/_shared/embeddings-vector.test.ts
import { assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import {
  composeEmbeddingBlurb,
} from "./place-embeddings.ts";
import {
  placeEmbeddingFacts,
  placeSourceText,
  shouldEmbed,
  type EmbeddablePlace,
} from "./embeddings-vector.ts";

function sample(over: Partial<EmbeddablePlace> = {}): EmbeddablePlace {
  return {
    id: "p1",
    name: "Contramar",
    category: "seafood",
    description: "Famous tuna tostadas. Bright, lively dining room in Roma Norte.",
    zone: "Roma Norte",
    city: "CDMX",
    address: "Calle Durango 200",
    price_level: 3,
    embedding: null,
    embedding_source_hash: null,
    embedding_source_text: null,
    ...over,
  };
}

Deno.test("placeEmbeddingFacts never mentions tags", () => {
  const facts = placeEmbeddingFacts(sample());
  assertStringIncludes(facts, "Name: Contramar");
  assertStringIncludes(facts, "Category: seafood");
  assertStringIncludes(facts, "Location: Roma Norte, CDMX");
  assertEquals(facts.toLowerCase().includes("tag"), false);
});

Deno.test("placeSourceText prefers stored on-update blurb", () => {
  const text = placeSourceText(sample({
    embedding_source_text: "Contramar is a lively seafood spot in Roma Norte.",
  }));
  assertEquals(text, "Contramar is a lively seafood spot in Roma Norte.");
});

Deno.test("composeEmbeddingBlurb is short and tag-free", () => {
  const blurb = composeEmbeddingBlurb(sample());
  assertStringIncludes(blurb, "Contramar");
  assertStringIncludes(blurb, "seafood");
  assertEquals(blurb.length <= 420, true);
  assertEquals(blurb.toLowerCase().includes("tag"), false);
});

Deno.test("shouldEmbed when vector or human text missing", () => {
  assertEquals(shouldEmbed(sample()), true);
  assertEquals(
    shouldEmbed(sample({
      embedding: "[0.1,0.2]",
      embedding_source_hash: "abc",
      embedding_source_text: null,
    })),
    true,
  );
  assertEquals(
    shouldEmbed(sample({
      embedding: "[0.1,0.2]",
      embedding_source_hash: "abc",
      embedding_source_text: "A short blurb.",
    })),
    false,
  );
});
