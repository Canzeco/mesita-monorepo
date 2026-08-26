import { assertEquals } from "jsr:@std/assert@1";
import {
  HISTORY_TURN_CAP,
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

Deno.test("sanitizeChatHistory: caps turn count and content length", () => {
  const long = "x".repeat(TURN_CONTENT_MAX + 50);
  const many = Array.from({ length: HISTORY_TURN_CAP + 5 }, (_, i) => ({
    role: i % 2 === 0 ? "user" : "assistant",
    content: `t${i}`,
  }));
  const capped = sanitizeChatHistory(many);
  assertEquals(capped.length, HISTORY_TURN_CAP);
  assertEquals(capped[0]?.content, "t5");
  assertEquals(sanitizeChatHistory([{ role: "user", content: long }])[0]?.content.length, TURN_CONTENT_MAX);
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
