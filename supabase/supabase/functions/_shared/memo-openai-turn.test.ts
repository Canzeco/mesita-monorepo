import { assertEquals } from "jsr:@std/assert@1";
import {
  CONTEXT_CHAR_BUDGET,
  TURN_CONTENT_MAX,
  buildChatMessages,
  sanitizeChatHistory,
} from "./memo-openai-turn.ts";

Deno.test("sanitizeChatHistory: drops garbage, keeps user/assistant text", () => {
  assertEquals(sanitizeChatHistory(null), []);
  assertEquals(sanitizeChatHistory("x"), []);
  assertEquals(
    sanitizeChatHistory([
      { role: "system", content: "nope" },
      { role: "user", content: "  hola  " },
      { role: "assistant", content: "" },
      { role: "assistant", content: "hi" },
      { role: "tool", content: "skip" },
    ]),
    [
      { role: "user", content: "hola" },
      { role: "assistant", content: "hi" },
    ],
  );
});

Deno.test("sanitizeChatHistory: keeps a long thread; fuse drops oldest by chars", () => {
  const many = Array.from({ length: 80 }, (_, i) => ({
    role: i % 2 === 0 ? "user" : "assistant",
    content: `t${i}`,
  }));
  const kept = sanitizeChatHistory(many);
  assertEquals(kept.length, 80);
  assertEquals(kept[0]?.content, "t0");
  assertEquals(kept[79]?.content, "t79");

  const long = "x".repeat(TURN_CONTENT_MAX + 50);
  assertEquals(
    sanitizeChatHistory([{ role: "user", content: long }])[0]?.content.length,
    TURN_CONTENT_MAX,
  );

  const chunk = "y".repeat(TURN_CONTENT_MAX);
  const overflow = sanitizeChatHistory([
    { role: "user", content: chunk },
    { role: "assistant", content: chunk },
    { role: "user", content: chunk },
    { role: "assistant", content: chunk },
    { role: "user", content: chunk },
  ]);
  const keptChars = overflow.reduce((n, t) => n + t.content.length, 0);
  assertEquals(keptChars <= CONTEXT_CHAR_BUDGET, true);
  assertEquals(overflow.length < 5, true);
  assertEquals(overflow[overflow.length - 1]?.content.length, TURN_CONTENT_MAX);
});

Deno.test("buildChatMessages: system + full history + latest user, every turn", () => {
  const messages = buildChatMessages("You are Memo.", [
    { role: "assistant", content: "Hola" },
    { role: "user", content: "tacos" },
    { role: "assistant", content: "¿dónde?" },
  ], "centro");
  assertEquals(messages, [
    { role: "system", content: "You are Memo." },
    { role: "assistant", content: "Hola" },
    { role: "user", content: "tacos" },
    { role: "assistant", content: "¿dónde?" },
    { role: "user", content: "centro" },
  ]);
});
