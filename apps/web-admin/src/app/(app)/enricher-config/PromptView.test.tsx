import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PromptView } from "./blocks";
import type { IntakePrompt } from "./actions";

// The prompt disclosure exists so an operator can read what a model is TOLD.
// Two ways it could fail them: showing a prompt that is not the one being sent
// (covered in supabase `_shared/intake-prompts.test.ts`, where the constants
// live), and LOOKING editable when it is not. This file pins the second.

const SCOUT: IntakePrompt = {
  key: "scout",
  fn: "3 · Serp",
  agent: "Scout",
  label: "SERP Summary",
  vendor: "Perplexity Agent",
  vendorNote: "One Perplexity Agent call. The preset is the Search model on Models.",
  writes: "The SERP Summary: soft web context only.",
  instructions: "You are a research assistant that writes ONE short paragraph.",
  input: 'Research the place "{place name}" in {street, zone, city}.',
};

const render = (prompt: IntakePrompt, preset?: string) =>
  renderToStaticMarkup(<PromptView prompt={prompt} preset={preset} />);

describe("PromptView", () => {
  it("never renders an editable control — a field that discards keystrokes is the bug", () => {
    const html = render(SCOUT);
    // The Images prompts on this same page ARE editable textareas. A read-only
    // prompt must not borrow their shape.
    expect(html).not.toContain("<textarea");
    expect(html).not.toContain("<input");
    expect(html).not.toContain("contenteditable");
    // And it must say so in words, not only in styling.
    expect(html).toContain("read-only");
  });

  it("renders the prompt inside a <pre>, so whitespace survives and it can be copied", () => {
    const html = render(SCOUT);
    expect(html).toContain("<pre");
    expect(html).toContain("You are a research assistant");
    expect(html).toContain("Research the place");
  });

  it("names the vendor, and appends the LIVE preset when one is passed", () => {
    // Pato's ask: the console must say it is a Perplexity agent, not just "a model".
    expect(render(SCOUT, "deep-research")).toContain("Perplexity Agent · deep-research");
    // No preset for the OpenAI steps — a preset they do not read would be a lie.
    const bare = render(SCOUT);
    expect(bare).toContain("Perplexity Agent");
    expect(bare).not.toContain("deep-research");
  });

  it("shows the agent's name when it has one, and both halves of the prompt", () => {
    const html = render(SCOUT);
    expect(html).toContain("Scout");
    expect(html).toContain("Instructions");
    expect(html).toContain("Message");
    expect(html).toContain("Writes.");
  });

  it("drops the agent chip for a step that has no named agent", () => {
    const html = render({
      ...SCOUT,
      key: "category",
      agent: null,
      label: "Category inference",
      vendor: "OpenAI",
    });
    expect(html).not.toContain(">Scout<");
    expect(html).toContain("OpenAI");
  });

  it("never leaks the retired placeholder names", () => {
    expect(render(SCOUT)).not.toMatch(/Agent [XY]\b/);
  });
});
