import assert from "node:assert/strict";
import test from "node:test";
import { channelFromUrl } from "./channels.ts";

test("an Instagram profile is not stored as the website", () => {
  assert.deepEqual(channelFromUrl("https://www.instagram.com/pujol/"), {
    key: "instagram_url",
    url: "https://www.instagram.com/pujol",
  });
  assert.equal(channelFromUrl("https://www.instagram.com/p/Cabc123/"), null);
});

test("a Facebook page is kept and a reserved path is dropped", () => {
  assert.equal(channelFromUrl("https://m.facebook.com/pujolmx")?.key, "facebook_url");
  assert.equal(channelFromUrl("https://www.facebook.com/events/123456789"), null);
});

test("WhatsApp and a review site are not the website", () => {
  assert.equal(channelFromUrl("https://wa.me/525500000000"), null);
  assert.equal(channelFromUrl("https://www.tripadvisor.com/Restaurant_Review"), null);
  assert.equal(channelFromUrl("https://pujol.com.mx/menu")?.key, "website_url");
});

