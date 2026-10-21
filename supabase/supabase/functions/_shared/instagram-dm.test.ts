import { assertEquals } from "jsr:@std/assert@1";
import {
  codeInMessage,
  dmLink,
  inboundMessages,
  readDmProfile,
  readInstagramDmConfig,
  signatureIsValid,
  verifyHandshake,
} from "./instagram-dm.ts";

const ALL = {
  META_IG_APP_SECRET: "s3cret",
  META_IG_VERIFY_TOKEN: "vt",
  META_IG_ACCESS_TOKEN: "tok",
  META_IG_USERNAME: "@Mesita.ai",
};

Deno.test("the DM channel is off until every Meta secret is set", () => {
  assertEquals(readInstagramDmConfig((k) => ALL[k as keyof typeof ALL]), {
    appSecret: "s3cret",
    verifyToken: "vt",
    accessToken: "tok",
    username: "mesita.ai",
  });
  for (const missing of Object.keys(ALL)) {
    const env = { ...ALL, [missing]: " " };
    assertEquals(readInstagramDmConfig((k) => env[k as keyof typeof env]), null, missing);
  }
  assertEquals(dmLink("mesita.ai"), "https://ig.me/m/mesita.ai");
});

Deno.test("a code is found anywhere in the message, in any case and spacing", () => {
  assertEquals(codeInMessage("MESITA-AB12CD"), "MESITA-AB12CD");
  assertEquals(codeInMessage("hola! mesita - ab12cd 🙌"), "MESITA-AB12CD");
  assertEquals(codeInMessage("MESITA-AB12CDE"), null);
  assertEquals(codeInMessage("hi Mesita, what's up"), null);
  assertEquals(codeInMessage(42), null);
});

Deno.test("only guest-sent text messages count: no echoes, no reads, no other objects", () => {
  const body = {
    object: "instagram",
    entry: [{
      messaging: [
        { sender: { id: "111" }, message: { text: "MESITA-AB12CD" } },
        { sender: { id: "999" }, message: { text: "You're verified", is_echo: true } },
        { sender: { id: "222" }, read: { mid: "x" } },
        { sender: { id: "333" }, message: { attachments: [{}] } },
        { sender: { id: "444" }, message: { text: "   " } },
      ],
    }],
  };
  assertEquals(inboundMessages(body), [{ senderId: "111", text: "MESITA-AB12CD" }]);
  assertEquals(inboundMessages({ ...body, object: "page" }), []);
  assertEquals(inboundMessages(null), []);
});

Deno.test("the profile gives the handle, followers and an https photo, or nothing", () => {
  assertEquals(
    readDmProfile({ username: "Vale.Soto", follower_count: 9300.7, profile_pic: "https://cdn/x.jpg" }),
    { handle: "vale.soto", followers: 9300, photoUrl: "https://cdn/x.jpg" },
  );
  assertEquals(
    readDmProfile({ username: "vale", follower_count: -1, profile_pic: "http://cdn/x.jpg" }),
    { handle: "vale", followers: 0, photoUrl: null },
  );
  assertEquals(readDmProfile({ follower_count: 5 }), null);
  assertEquals(readDmProfile(null), null);
});

Deno.test("the subscribe handshake answers only the right token", () => {
  const q = (t: string) =>
    new URLSearchParams({ "hub.mode": "subscribe", "hub.verify_token": t, "hub.challenge": "42" });
  assertEquals(verifyHandshake(q("vt"), "vt"), "42");
  assertEquals(verifyHandshake(q("nope"), "vt"), null);
});

Deno.test("a POST counts only with Meta's signature over the exact body", async () => {
  const raw = '{"object":"instagram","entry":[]}';
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode("s3cret"),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = [...new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw)))]
    .map((b) => b.toString(16).padStart(2, "0")).join("");
  assertEquals(await signatureIsValid(raw, `sha256=${sig}`, "s3cret"), true);
  assertEquals(await signatureIsValid(raw + " ", `sha256=${sig}`, "s3cret"), false);
  assertEquals(await signatureIsValid(raw, `sha256=${sig}`, "other"), false);
  assertEquals(await signatureIsValid(raw, sig, "s3cret"), false);
  assertEquals(await signatureIsValid(raw, null, "s3cret"), false);
});
