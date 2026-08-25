import { assertEquals } from "jsr:@std/assert@1";
import { DEFAULT_MEMO_CONFIG, normalizeMemoConfig } from "./memo-config.ts";

Deno.test("normalizeMemoConfig: null/garbage falls back to empty greeting/instructions", () => {
  assertEquals(normalizeMemoConfig(null), DEFAULT_MEMO_CONFIG);
  assertEquals(normalizeMemoConfig({}), DEFAULT_MEMO_CONFIG);
  assertEquals(normalizeMemoConfig("x"), DEFAULT_MEMO_CONFIG);
});

Deno.test("normalizeMemoConfig: preserves saved greeting/instructions including blanks", () => {
  const out = normalizeMemoConfig({
    greeting: "Hola",
    instructions: "Be brief.",
    openaiModel: "gpt-4o",
    perplexityModel: "sonar",
    provider: "openai",
    webGrounding: true,
  });
  assertEquals(out, {
    greeting: "Hola",
    instructions: "Be brief.",
    openaiModel: "gpt-4o",
    perplexityModel: "sonar",
    provider: "openai",
    webGrounding: true,
  });
});

Deno.test("normalizeMemoConfig: webGrounding only turns on when explicitly true", () => {
  assertEquals(normalizeMemoConfig({ webGrounding: true }).webGrounding, true);
  assertEquals(normalizeMemoConfig({ webGrounding: false }).webGrounding, false);
  assertEquals(normalizeMemoConfig({ webGrounding: "true" }).webGrounding, false);
});

Deno.test("normalizeMemoConfig: extra keys are dropped", () => {
  const out = normalizeMemoConfig({ greeting: "x", leftover: 1 });
  assertEquals(out.greeting, "x");
  assertEquals("leftover" in out, false);
});
