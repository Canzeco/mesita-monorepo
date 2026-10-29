// Every prompt the Enricher sends, as the admin console reads them.
//
// WHY THIS FILE EXISTS. The Crenup pipeline spends real money per run and its
// instructions lived only in Deno source, so an operator could see the KNOBS
// (candidate counts, models, presets) but never what the models were actually
// TOLD. This module is the reader: it imports the same constants and the same
// builder functions the pipeline calls, so what the console renders IS what the
// vendor receives. A hand-copied prompt in the Next.js app would drift the first
// time someone edited the real one; there is no copy here to drift.
//
// Same contract as `enrichmentTriggersMeta` (enrich-triggers.ts): CODE-DEFINED
// here, shipped by `admin-web-get-config`, rendered by a console that keeps no
// copy of the list.
//
// READ-ONLY, deliberately. These are not `app_config` knobs — editing a prompt
// live needs validation, versioning and an empty-prompt guard, which is a
// separate decision. The console must present them so they cannot be mistaken
// for an editable field.

import { buildScoutInput, SCOUT_INSTRUCTIONS } from "./enrich-serp.ts";
import {
  buildResolverInput,
  CHANNEL_FIELDS,
  RESOLVER_INSTRUCTIONS,
} from "./enrich-channel-discovery.ts";
import {
  buildPresentationInput,
  PRESENTATION_INSTRUCTIONS,
} from "./enrich-synthesis.ts";
import { CRENUP_STEP_META, type CrenupStep } from "./crenup-ladder.ts";

/** One prompt-bearing step, as the console renders it. */
export type CrenupPrompt = {
  /** Stable id for the console's anchor + test pinning. */
  key: string;
  /**
   * Which Enricher step this prompt belongs to — a pointer into Docs › Create ·
   * Enrich · Edit §A's numbering, read off the ladder (`stepOf`), never a
   * numbering of its own. `null` for a step that runs inside another function
   * rather than owning a row.
   */
  fn: string | null;
  /** The named agent, when the step has one. Scout and Resolver are the two. */
  agent: string | null;
  label: string;
  /** The vendor that receives this prompt, said plainly. */
  vendor: string;
  /**
   * How the call is made and where its model/preset knob lives, so an operator
   * reading a prompt can find the setting that governs it.
   */
  vendorNote: string;
  /** What the step writes, so a prompt can be tied to a field on the place. */
  writes: string;
  /** The verbatim system instructions the vendor receives. */
  instructions: string;
  /**
   * The per-place message, rendered by the REAL builder with sentinel values so
   * every conditional branch fires. Placeholders read `{like this}`.
   */
  input: string;
};

// Sentinels chosen so every optional branch in every builder renders — an
// operator should see the FULLEST form of each message, not the degraded one.
const PLACE = {
  name: "{place name}",
  locationLine: "{street, zone, city}",
  category: "{category}",
};

/** "2 · Serp": the ladder's own number and label, so a renumbering cannot leave this behind. */
function stepOf(step: CrenupStep): string {
  const { index, label } = CRENUP_STEP_META[step];
  return `${index} · ${label}`;
}

function scoutPrompt(): CrenupPrompt {
  return {
    key: "scout",
    fn: stepOf("serp"),
    agent: "Scout",
    label: "SERP Summary",
    vendor: "Perplexity Agent",
    vendorNote:
      "One Perplexity Agent call — the managed Agents API, not chat completions " +
      "and not Sonar Chat, which belongs to Memo. The search preset is the " +
      "Search model on Models (shown beside the vendor above, never hardcoded " +
      "here) — the Resolver at Links reads that same setting.",
    writes:
      "The SERP Summary: soft web context only. It is never persisted as a fact, " +
      "and it grounds two later steps — the Resolver's link selection and the " +
      "Presentation synthesis.",
    instructions: SCOUT_INSTRUCTIONS,
    input: buildScoutInput(PLACE),
  };
}

function resolverPrompt(): CrenupPrompt {
  // Two candidates per field so the pool block renders as a list, and every
  // sibling/website/serp branch is populated.
  const candidates = Object.fromEntries(
    CHANNEL_FIELDS.map((f) => [f, [`{${f} candidate 1}`, `{${f} candidate 2}`]]),
  );
  return {
    key: "resolver",
    fn: stepOf("links"),
    agent: "Resolver",
    label: "Review & Select Links",
    vendor: "Firecrawl Search, then Perplexity Agent",
    vendorNote:
      "Firecrawl Search gathers the candidate pool — one search per source, at " +
      "the per-source counts above. Then ONE Perplexity Agent call reviews every " +
      "pool and returns one URL per field or null. With no Perplexity key the " +
      "step degrades to the first shape-valid Firecrawl candidate and this " +
      "prompt is never sent.",
    writes:
      "website_url, instagram_url, facebook_url, opentable_url, uber_eats_url — " +
      "each the place's own official channel, or null.",
    instructions: RESOLVER_INSTRUCTIONS,
    input: buildResolverInput(PLACE, CHANNEL_FIELDS, candidates, {
      siblings: {
        website_url: "{already-known website}",
        instagram_url: "{already-known instagram}",
      },
      serpContext: "{the Scout's SERP Summary}",
      website: "{official website}",
    }),
  };
}

function presentationPrompt(): CrenupPrompt {
  return {
    key: "presentation",
    fn: stepOf("description"),
    agent: null,
    label: "Presentation synthesis",
    vendor: "OpenAI",
    vendorNote:
      "One chat-completions call in JSON mode, temperature 0.2. The model is the " +
      "Synthesis quality setting on Models. It does NOT browse — it may use only " +
      "the source material the earlier functions gathered.",
    writes:
      "The Presentation (place_profiles.description), the Mesita tags (picked " +
      "from the live tag vocabulary), 1–7 Mesita Families (picked from the " +
      "live family list; none when the main Google category is not enabled), " +
      "the machine summary that the Embedding " +
      "step vectorises and the Mesita name candidate.",
    instructions: PRESENTATION_INSTRUCTIONS,
    input: buildPresentationInput({
      ...PLACE,
      branchAnchor: "Neighborhood / zone: {zone} · City: {city}",
      tagVocabulary: ["{tag slug}", "… one per live tag"],
      familyVocabulary: ["{family slug} — {Family label}", "… one per live family"],
      grounding:
        "Google categories: {google types, primary first}\n\n" +
        "Google attributes: {google tags}\n\n" +
        "Instagram bio: {instagram bio}\n\n" +
        "Google reviews (sample):\n{newest Google reviews}\n\n" +
        "Web editorial color (SOFT context — background only, NOT authoritative; " +
        "do not treat as a source of facts, ratings, or prices):\n" +
        "{the Scout's SERP Summary}",
    }),
  };
}



/**
 * Every Crenup prompt, in pipeline order. Called per request — the builders are
 * pure and cheap, and calling them fresh is what guarantees the payload tracks
 * the source rather than a snapshot taken at deploy time.
 *
 * NOT here: the Images prompts (function 6). Those already live on `app_config`
 * and the console already renders them as EDITABLE fields — listing them again
 * read-only would state two different truths about the same prompt.
 */
export function crenupPromptsMeta(): CrenupPrompt[] {
  return [
    scoutPrompt(),
    resolverPrompt(),
    presentationPrompt(),
  ];
}
