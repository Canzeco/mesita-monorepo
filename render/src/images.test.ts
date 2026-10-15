import assert from "node:assert/strict";
import test from "node:test";
import { applyPhotoOrder, sortPlacePhotos } from "./images.ts";

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
