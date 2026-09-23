// Run: deno test supabase/functions/_shared/diamond-list.test.ts
//
// The Diamond List is binary (MESITA-2044): on it or not. These pin the read
// side (a stray silver/gold slot is NOT on the list) and the write guard both
// invitation writers share (only `diamond` — or null to revoke — passes).

import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  DIAMOND_LIST_NAME,
  diamondListLabel,
  onDiamondList,
  parseListGrantKey,
} from "./diamond-list.ts";
import { RESERVATIONIST_KB_TEXT } from "./reservationist-kb.ts";
import { buildMemoTools } from "./memo-airlock-tools.ts";
import { buildAgentSystemPrompt } from "./memo-airlock-prompt.ts";
import { TOOLS as CONSUMER_MCP_TOOLS } from "../consumer-mcp/tools.ts";

Deno.test("onDiamondList: diamond (and the legacy aura bridge) is on the list", () => {
  assertEquals(onDiamondList("diamond"), true);
  assertEquals(onDiamondList("aura"), true);
});

Deno.test("onDiamondList: everything else is off — no in between", () => {
  for (const k of ["bronze", "silver", "gold", "standard", "influencer", "premium", "", null, undefined, "magnetic"]) {
    assertEquals(onDiamondList(k), false, String(k));
  }
});

Deno.test("diamondListLabel: the list's name or null, never a metal", () => {
  assertEquals(diamondListLabel("diamond"), "Diamond List");
  assertEquals(DIAMOND_LIST_NAME, "Diamond List");
  for (const k of ["bronze", "silver", "gold", null]) {
    assertEquals(diamondListLabel(k), null, String(k));
  }
});

Deno.test("parseListGrantKey: diamond grants, null/absent revokes where allowed", () => {
  assertEquals(parseListGrantKey("diamond", { allowRevoke: true }), { ok: true, classKey: "diamond" });
  assertEquals(parseListGrantKey(" Diamond ", { allowRevoke: false }), { ok: true, classKey: "diamond" });
  assertEquals(parseListGrantKey(null, { allowRevoke: true }), { ok: true, classKey: null });
  assertEquals(parseListGrantKey(undefined, { allowRevoke: true }), { ok: true, classKey: null });
});

Deno.test("parseListGrantKey: a PIN batch cannot revoke", () => {
  const r = parseListGrantKey(null, { allowRevoke: false });
  assertEquals(r.ok, false);
});

Deno.test("parseListGrantKey: silver, gold, bronze and junk are refused with a clear reason", () => {
  for (const k of ["silver", "gold", "bronze", "aura", "", "vip"]) {
    for (const allowRevoke of [true, false]) {
      const r = parseListGrantKey(k, { allowRevoke });
      assertEquals(r.ok, false, `${k} allowRevoke=${allowRevoke}`);
      if (!r.ok) {
        assert(r.error.includes("diamond"), r.error);
      }
    }
  }
  const silver = parseListGrantKey("silver", { allowRevoke: true });
  assert(!silver.ok && silver.error.includes("Diamond List"), JSON.stringify(silver));
});

// ── Guest- and staff-facing copy this package owns ─────────────────────
//
// Every string below reaches a person (via Memo, the Reservationist or a
// guest's own AI assistant). It FAILS if any of them grounds a model in a
// class, a metal, a ladder, VIP, or "Diamond" as a bare status noun.
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
  [/You're Diamond/i, "You're Diamond"],
  [/\bDiamond\b(?! List)/, "Diamond without List"],
  [/\bPassport\b/i, "Passport"],
];

function assertClean(label: string, text: string) {
  for (const [re, name] of BANNED) {
    assertEquals(re.test(text), false, `${label} says ${name}: ${text.match(re)?.[0]}`);
  }
}

Deno.test("copy: the Reservationist brief speaks of the Lista Diamante only", () => {
  assertClean("RESERVATIONIST_KB_TEXT", RESERVATIONIST_KB_TEXT);
  assert(RESERVATIONIST_KB_TEXT.includes("Lista Diamante"));
});

Deno.test("copy: Memo's knowledge tool and operating rules name the Diamond List", () => {
  const tool = buildMemoTools().find((t) => t.name === "mesita_knowledge")!;
  assertClean("mesita_knowledge description", tool.description);
  assert(tool.description.includes("Diamond List"));
  const prompt = buildAgentSystemPrompt("", null);
  const rule = prompt.split("\n").find((l) => l.includes("MESITA ITSELF"))!;
  assertClean("Memo operating rule", rule);
});

Deno.test("copy: the consumer MCP profile tool says Diamond List, not a class", () => {
  const profile = CONSUMER_MCP_TOOLS.find((t) => t.name === "get_profile")!;
  assertClean("get_profile description", profile.description);
  assert(profile.description.includes("Diamond List"));
});
