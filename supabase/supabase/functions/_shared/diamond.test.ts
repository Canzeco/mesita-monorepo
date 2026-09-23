// Run: deno test supabase/functions/_shared/diamond.test.ts
//
// Diamond is binary (MESITA-2044): Diamond or not. These pin the read
// side (a stray silver/gold slot is NOT Diamond) and the write guard both
// invitation writers share (only `diamond` — or null to revoke — passes).

import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  DIAMOND_NAME,
  diamondLabel,
  isDiamond,
  parseDiamondGrantKey,
} from "./diamond.ts";
import { RESERVATIONIST_KB_TEXT } from "./reservationist-kb.ts";
import { buildMemoTools } from "./memo-airlock-tools.ts";
import { buildAgentSystemPrompt } from "./memo-airlock-prompt.ts";
import { TOOLS as CONSUMER_MCP_TOOLS } from "../consumer-mcp/tools.ts";

Deno.test("isDiamond: diamond (and the legacy aura bridge) is Diamond", () => {
  assertEquals(isDiamond("diamond"), true);
  assertEquals(isDiamond("aura"), true);
});

Deno.test("isDiamond: everything else is off — no in between", () => {
  for (const k of ["bronze", "silver", "gold", "standard", "influencer", "premium", "", null, undefined, "magnetic"]) {
    assertEquals(isDiamond(k), false, String(k));
  }
});

Deno.test("diamondLabel: the name or null, never a metal", () => {
  assertEquals(diamondLabel("diamond"), "Diamond");
  assertEquals(DIAMOND_NAME, "Diamond");
  for (const k of ["bronze", "silver", "gold", null]) {
    assertEquals(diamondLabel(k), null, String(k));
  }
});

Deno.test("parseDiamondGrantKey: diamond grants, null/absent revokes where allowed", () => {
  assertEquals(parseDiamondGrantKey("diamond", { allowRevoke: true }), { ok: true, classKey: "diamond" });
  assertEquals(parseDiamondGrantKey(" Diamond ", { allowRevoke: false }), { ok: true, classKey: "diamond" });
  assertEquals(parseDiamondGrantKey(null, { allowRevoke: true }), { ok: true, classKey: null });
  assertEquals(parseDiamondGrantKey(undefined, { allowRevoke: true }), { ok: true, classKey: null });
});

Deno.test("parseDiamondGrantKey: a PIN batch cannot revoke", () => {
  const r = parseDiamondGrantKey(null, { allowRevoke: false });
  assertEquals(r.ok, false);
});

Deno.test("parseDiamondGrantKey: silver, gold, bronze and junk are refused with a clear reason", () => {
  for (const k of ["silver", "gold", "bronze", "aura", "", "vip"]) {
    for (const allowRevoke of [true, false]) {
      const r = parseDiamondGrantKey(k, { allowRevoke });
      assertEquals(r.ok, false, `${k} allowRevoke=${allowRevoke}`);
      if (!r.ok) {
        assert(r.error.includes("diamond"), r.error);
      }
    }
  }
  const silver = parseDiamondGrantKey("silver", { allowRevoke: true });
  assert(!silver.ok && silver.error.includes("Diamond"), JSON.stringify(silver));
});

// ── Guest- and staff-facing copy this package owns ─────────────────────
//
// Every string below reaches a person (via Memo, the Reservationist or a
// guest's own AI assistant). It FAILS if any of them grounds a model in a
// class, a metal, a ladder, VIP, or the retired "Diamond List" (MESITA-2046).
// Spanish is included for the Reservationist's es-MX brief.

const BANNED: [RegExp, string][] = [
  [/\bVIP\b/i, "VIP"],
  [/\bclass(es)?\b/i, "class"],
  [/\bclases?\b/i, "clase"],
  [/\btiers?\b/i, "tier"],
  [/\brank(s|ed)?\b/i, "rank"],
  [/\brungs?\b/i, "rung"],
  [/\blevels?\b/i, "level"],
  [/\bnivel(es)?\b/i, "nivel"],
  [/\bBronze\b/i, "Bronze"],
  [/\bSilver\b/i, "Silver"],
  [/\bGold\b/i, "Gold"],
  [/\bclimb/i, "climb"],
  [/unlock a higher/i, "unlock a higher"],
  [/Diamond List|Lista Diamante/i, "the retired Diamond List"],
  [/\bPassport\b/i, "Passport"],
];

function assertClean(label: string, text: string) {
  for (const [re, name] of BANNED) {
    assertEquals(re.test(text), false, `${label} says ${name}: ${text.match(re)?.[0]}`);
  }
}

Deno.test("copy: the Reservationist brief speaks of Diamante only", () => {
  assertClean("RESERVATIONIST_KB_TEXT", RESERVATIONIST_KB_TEXT);
  assert(RESERVATIONIST_KB_TEXT.includes("Diamante"));
});

Deno.test("copy: Memo's knowledge tool and operating rules name Diamond", () => {
  const tool = buildMemoTools().find((t) => t.name === "mesita_knowledge")!;
  assertClean("mesita_knowledge description", tool.description);
  assert(tool.description.includes("Diamond"));
  const prompt = buildAgentSystemPrompt("", null);
  const rule = prompt.split("\n").find((l) => l.includes("MESITA ITSELF"))!;
  assertClean("Memo operating rule", rule);
});

Deno.test("copy: the consumer MCP profile tool says Diamond, not a class", () => {
  const profile = CONSUMER_MCP_TOOLS.find((t) => t.name === "get_profile")!;
  assertClean("get_profile description", profile.description);
  assert(profile.description.includes("Diamond"));
});
