import { assertEquals } from "jsr:@std/assert@1";
import { pairedAnalyses, photoAnalysisMap, readPhotoAnalyses } from "./photo-analysis.ts";

Deno.test("a description survives the copy into storage", () => {
  const analyses = readPhotoAnalyses([
    { url: "https://google.example/a", source: "google", text: "A chandelier over the floor." },
    { url: "http://insecure.example/b", source: "google", text: "dropped" },
    { url: "https://cdn.example/c", source: "instagram", text: "  " },
  ]);
  assertEquals(analyses, [{
    url: "https://google.example/a",
    source: "google",
    text: "A chandelier over the floor.",
  }]);
  assertEquals(pairedAnalyses(
    [{ sourceUrl: "https://google.example/a", publicUrl: "https://storage.example/a.jpg" }],
    analyses,
  ), [{
    sourceUrl: "https://google.example/a",
    publicUrl: "https://storage.example/a.jpg",
    source: "google",
    text: "A chandelier over the floor.",
  }]);
});

Deno.test("the dialog can look the text up by either URL", () => {
  assertEquals(photoAnalysisMap([{
    source_url: "https://google.example/a",
    public_url: "https://storage.example/a.jpg",
    analysis_text: "A chandelier over the floor.",
  }]), {
    "https://google.example/a": "A chandelier over the floor.",
    "https://storage.example/a.jpg": "A chandelier over the floor.",
  });
  assertEquals(photoAnalysisMap(null), {});
});
