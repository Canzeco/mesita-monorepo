// deno test supabase/functions/_shared/embeddings-vector.test.ts
import { assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import {
  clampToWordLimit,
  composeEmbeddingBlurb,
  countWords,
  MAX_BLURB_WORDS,
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
  assertEquals(countWords(blurb) <= MAX_BLURB_WORDS, true);
  assertEquals(blurb.toLowerCase().includes("tag"), false);
});

Deno.test("clampToWordLimit never truncates mid-word", () => {
  const long =
    "Strana is a high-energy night club located in the upscale Del Valle " +
    "neighborhood of San Pedro Garza Garcia. Known for its vibrant atmosphere, " +
    "the venue features immersive lighting, acrobatic performances, and pulsating " +
    "music from top DJs and international artists, creating an unforgettable " +
    "nightlife experience. With a focus on glamour and spectacle, Strana offers " +
    "a unique setting for those seeking an extraordinary night out.";
  const clamped = clampToWordLimit(long, 60);
  assertEquals(countWords(long) > 60, true);
  assertEquals(countWords(clamped), 60);
  // Whole-word ceiling — ends on "an", never the old 420-char mid-slice "ni".
  assertEquals(clamped.endsWith(" an"), true);
  assertEquals(clamped.includes("extraordinary"), false);
  assertEquals(clamped.endsWith(" ni"), false);
  // Char-slice regression: the old 420-char cut landed mid-"night".
  const charSliced = long.replace(/\s+/g, " ").trim().slice(0, 420);
  assertEquals(charSliced.endsWith(" ni"), true);
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
