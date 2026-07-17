import { json } from "../_shared/http.ts";

export type MemoConfigBody = {
  greeting?: string;
  instructions?: string;
  provider?: string;
  openaiModel?: string;
  webGrounding?: boolean;
  perplexityModel?: string;
};

// Keep these in lock-step with the admin picker (Memo Config actions.ts).
const PROVIDERS = new Set(["openai"]);
const OPENAI_MODELS = new Set(["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini", "gpt-4.1"]);
const PERPLEXITY_MODELS = new Set([
  "sonar",
  "sonar-pro",
  "sonar-reasoning",
  "sonar-reasoning-pro",
]);

const MAX_GREETING = 1000;
const MAX_INSTRUCTIONS = 8000;

export type MemoConfigPatchResult =
  | { ok: true; patch: Record<string, unknown> }
  | { ok: false; response: Response };

export function buildMemoConfigPatch(body: MemoConfigBody): MemoConfigPatchResult {
  const patch: Record<string, unknown> = {};

  if (body.greeting !== undefined) {
    if (typeof body.greeting !== "string" || body.greeting.trim().length === 0) {
      return {
        ok: false,
        response: json({ ok: false, error: "greeting must be a non-empty string" }, 400),
      };
    }
    if (body.greeting.length > MAX_GREETING) {
      return {
        ok: false,
        response: json({ ok: false, error: `greeting must be ≤ ${MAX_GREETING} chars` }, 400),
      };
    }
    patch.memo_greeting = body.greeting;
  }

  if (body.instructions !== undefined) {
    if (
      typeof body.instructions !== "string" ||
      body.instructions.trim().length === 0
    ) {
      return {
        ok: false,
        response: json({ ok: false, error: "instructions must be a non-empty string" }, 400),
      };
    }
    if (body.instructions.length > MAX_INSTRUCTIONS) {
      return {
        ok: false,
        response: json(
          { ok: false, error: `instructions must be ≤ ${MAX_INSTRUCTIONS} chars` },
          400,
        ),
      };
    }
    patch.memo_instructions = body.instructions;
  }

  if (body.provider !== undefined) {
    if (typeof body.provider !== "string" || !PROVIDERS.has(body.provider)) {
      return {
        ok: false,
        response: json({ ok: false, error: "provider must be openai" }, 400),
      };
    }
    patch.memo_provider = body.provider;
  }

  if (body.openaiModel !== undefined) {
    if (typeof body.openaiModel !== "string" || !OPENAI_MODELS.has(body.openaiModel)) {
      return {
        ok: false,
        response: json({ ok: false, error: "openaiModel is not a supported model" }, 400),
      };
    }
    patch.memo_openai_model = body.openaiModel;
  }

  if (body.webGrounding !== undefined) {
    if (typeof body.webGrounding !== "boolean") {
      return {
        ok: false,
        response: json({ ok: false, error: "webGrounding must be a boolean" }, 400),
      };
    }
    patch.memo_web_grounding = body.webGrounding;
  }

  if (body.perplexityModel !== undefined) {
    if (
      typeof body.perplexityModel !== "string" ||
      !PERPLEXITY_MODELS.has(body.perplexityModel)
    ) {
      return {
        ok: false,
        response: json(
          { ok: false, error: "perplexityModel is not a supported model" },
          400,
        ),
      };
    }
    patch.memo_perplexity_model = body.perplexityModel;
  }

  if (Object.keys(patch).length === 0) {
    return {
      ok: false,
      response: json({ ok: false, error: "Nothing to update" }, 400),
    };
  }

  return { ok: true, patch };
}
