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
  placeNameEmbedText,
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
    "the place features immersive lighting, acrobatic performances, and pulsating " +
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

Deno.test("placeNameEmbedText is the resolved name, not the summary", () => {
  assertEquals(placeNameEmbedText(sample()), "Contramar");
  assertEquals(
    placeNameEmbedText(sample({ name: "  El  Nuevo   Nombre  " })),
    "El Nuevo Nombre",
  );
  const facts = placeEmbeddingFacts(sample());
  assertEquals(facts.includes("Famous tuna"), true);
  assertEquals(placeNameEmbedText(sample()).includes("Famous"), false);
});
