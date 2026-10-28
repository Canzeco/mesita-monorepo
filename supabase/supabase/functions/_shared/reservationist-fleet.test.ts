// _shared/reservationist-fleet.test.ts
//
// The four workflow graphs are pushed LIVE to ElevenLabs by
// supabase-edgefunc-sync-reservationist mode "workflows". A dangling edge or
// an edge_order naming a missing edge is a broken phone agent that no build
// catches, so this pins the graphs' wiring — never their copy.

import { assert, assertEquals, assertThrows } from "jsr:@std/assert@1";
import { FLEET_AGENTS, fleetWorkflows } from "./reservationist-fleet.ts";

const TOOL_NAMES = [
  "a1_report_outcome",
  "a2_confirm_reservation",
  "a2_cancel_reservation",
  "a3_verify_caller",
  "a3_cancel_reservation",
  "a4_verify_caller",
  "a4_find_reservation",
  "a4_cancel_reservation",
  "get_reservation",
];
const ids = () => new Map(TOOL_NAMES.map((n) => [n, `tool_${n}`]));

Deno.test("fleetWorkflows: one graph per fleet agent, every edge wired to real nodes", () => {
  const wfs = fleetWorkflows(ids());
  assertEquals(Object.keys(wfs).sort(), FLEET_AGENTS.map((a) => a.key).sort());
  for (const [key, wf] of Object.entries(wfs)) {
    assert(wf.nodes.start_node, `${key}: no start_node`);
    assert(wf.nodes.end_node, `${key}: no end_node`);
    for (const [id, e] of Object.entries(wf.edges)) {
      assert(wf.nodes[e.source as string], `${key}.${id}: source ${e.source} missing`);
      assert(wf.nodes[e.target as string], `${key}.${id}: target ${e.target} missing`);
    }
    for (const [id, n] of Object.entries(wf.nodes)) {
      for (const eid of (n.edge_order as string[] | undefined) ?? []) {
        assert(wf.edges[eid], `${key}.${id}: edge_order names missing edge ${eid}`);
        assertEquals(wf.edges[eid].source, id, `${key}.${id}: edge_order edge ${eid} leaves elsewhere`);
      }
    }
  }
});

Deno.test("fleetWorkflows: tool nodes carry the live workspace tool ids", () => {
  const wfs = fleetWorkflows(ids());
  const used = new Set<string>();
  for (const wf of Object.values(wfs)) {
    for (const n of Object.values(wf.nodes)) {
      if (n.type !== "tool") continue;
      for (const t of n.tools as Array<{ tool_id: string }>) used.add(t.tool_id);
    }
  }
  assertEquals([...used].sort(), TOOL_NAMES.map((n) => `tool_${n}`).sort());
});

Deno.test("fleetWorkflows: a missing workspace tool refuses to build", () => {
  const m = ids();
  m.delete("a4_find_reservation");
  assertThrows(() => fleetWorkflows(m), Error, "workspace missing tool a4_find_reservation");
});
