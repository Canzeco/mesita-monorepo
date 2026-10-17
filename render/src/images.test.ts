import assert from "node:assert/strict";
import test from "node:test";
import {
  applyPhotoOrder,
  defaultImageKnobs,
  fetchInstagramPosts,
  rankGallery,
  rankPostsByLikes,
  sortPlacePhotos,
} from "./images.ts";

const A = "https://lh3.googleusercontent.com/a";
const B = "https://lh3.googleusercontent.com/b";
const C = "https://lh3.googleusercontent.com/c";

test("a partial rank still keeps every photo, best first", () => {
  assert.deepEqual(applyPhotoOrder([A, B, C], [2, 0]), [C, A, B]);
  assert.deepEqual(applyPhotoOrder([A, B], "nope"), [A, B]);
});

test("ten photos is the gallery cap", () => {
  const urls = Array.from({ length: 12 }, (_, i) => `https://lh3.googleusercontent.com/${i}`);
  assert.equal(applyPhotoOrder(urls, urls.map((_, i) => i)).length, 10);
});

test("vision rank leads with the photo the model put first", async () => {
  const fetchImpl: typeof fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body ?? "{}")) as {
      messages?: { content?: unknown }[];
    };
    const content = body.messages?.[0]?.content;
    if (Array.isArray(content)) return Response.json({ choices: [{ message: { content: "A bright dining room." } }] });
    return Response.json({ choices: [{ message: { content: JSON.stringify({ order: [1, 0] }) } }] });
  };
  assert.deepEqual(await sortPlacePhotos([A, B], "sk-test", fetchImpl), [B, A]);
});

test("a failed describe keeps Google's order", async () => {
  const fetchImpl: typeof fetch = async () => Response.json({ choices: [{ message: { content: "" } }] });
  assert.deepEqual(await sortPlacePhotos([A, B], "sk-test", fetchImpl), [A, B]);
});

test("no OpenAI key still returns the gathered photos", async () => {
  assert.deepEqual(
    await sortPlacePhotos([A, B], "", async () => {
      throw new Error("network");
    }),
    [A, B],
  );
});

test("likes rank the newest Instagram window", () => {
  assert.deepEqual(rankPostsByLikes([
    { displayUrl: A, likesCount: 2 },
    { displayUrl: B, likesCount: 40 },
    { displayUrl: "http://insecure.example/c", likesCount: 100 },
    { displayUrl: C, likesCount: 9 },
  ]), [B, C, A]);
});

test("vision off keeps gather order and does not call the model", async () => {
  const knobs = { ...defaultImageKnobs(), visionEnabled: false, saveTotalImages: 3 };
  assert.deepEqual(
    (await rankGallery({
      google: [A, B],
      instagram: [C, "https://lh3.googleusercontent.com/d"],
      knobs,
      openaiKey: "sk-test",
      fetchImpl: async () => {
        throw new Error("vision is off");
      },
    })).urls,
    [A, B, C],
  );
});

test("the saved analysis prompt is what vision is told", async () => {
  let told = "";
  const knobs = {
    ...defaultImageKnobs(),
    imageAnalysisPrompt: "Name the room.",
    imageSortingPrompt: "Best room first.",
    visionModel: "gpt-4o",
    sortModel: "gpt-4o-mini",
    saveTotalImages: 2,
  };
  const fetchImpl: typeof fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body ?? "{}")) as {
      model?: string;
      messages?: { content?: unknown }[];
    };
    const content = body.messages?.[0]?.content;
    if (Array.isArray(content)) {
      told = `${body.model}:${(content[0] as { text?: string }).text ?? ""}`;
      return Response.json({ choices: [{ message: { content: "A dining room." } }] });
    }
    told += `|${body.model}:${typeof content === "string" ? content : ""}`;
    return Response.json({ choices: [{ message: { content: JSON.stringify({ order: [1, 0] }) } }] });
  };
  const ranked = await rankGallery({ google: [A, B], instagram: [], knobs, openaiKey: "sk-test", fetchImpl });
  assert.deepEqual(ranked.urls, [B, A]);
  assert.deepEqual(ranked.analyses, [
    { url: A, source: "google", text: "A dining room." },
    { url: B, source: "google", text: "A dining room." },
  ]);
  assert.match(told, /^gpt-4o:Name the room\./);
  assert.match(told, /gpt-4o-mini:Best room first\./);
});

test("an Apify miss leaves Instagram photos empty and logs one line", async () => {
  let sent: { username?: string[]; resultsLimit?: number; skipPinnedPosts?: boolean } = {};
  const lines: string[] = [];
  const previous = console.error;
  console.error = (...args: unknown[]) => {
    lines.push(args.map(String).join(" "));
  };
  try {
    const posts = await fetchInstagramPosts({
      instagramUrl: "https://www.instagram.com/pujol/",
      depth: 10,
      apifyKey: "apify-test",
      fetchImpl: async (input, init) => {
        assert.match(String(input), /apify~instagram-post-scraper/);
        sent = JSON.parse(String(init?.body ?? "{}"));
        return new Response('{\n  "error": {\n    "message": "Too many outstanding invoices"\n  }\n}', { status: 403 });
      },
    });
    assert.deepEqual(posts, []);
  } finally {
    console.error = previous;
  }
  assert.equal(lines.length, 1);
  assert.equal(lines[0].includes("\n"), false);
  assert.match(lines[0], /\[images\] apify 403/);
  assert.match(lines[0], /Too many outstanding invoices/);
  assert.deepEqual(sent.username, ["pujol"]);
  assert.equal(sent.resultsLimit, 10);
  assert.equal(sent.skipPinnedPosts, true);
});
