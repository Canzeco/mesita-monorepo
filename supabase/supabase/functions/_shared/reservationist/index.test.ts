// _shared/reservationist/index.test.ts
//
// The graphs and knowledge docs are pushed LIVE to ElevenLabs by
// supabase-edgefunc-sync-reservationist. A dangling edge is a broken phone
// agent no build catches, and a wrong fact is said out loud on a call — so
// this pins the wiring and the facts the money and naming rules depend on.

import { assert, assertEquals, assertThrows } from "jsr:@std/assert@1";
import { FLEET, fleetWorkflows, knowledgeFor, TOOL_NAMES } from "./index.ts";

const ids = () => new Map(TOOL_NAMES.map((n) => [n, `tool_${n}`]));

Deno.test("fleetWorkflows: one graph per agent, every edge wired to real nodes", () => {
  const wfs = fleetWorkflows(ids());
  assertEquals(Object.keys(wfs).sort(), FLEET.map((a) => a.key).sort());
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

Deno.test("fleetWorkflows: each agent's tool nodes use only its own tools, and every tool is used", () => {
  const wfs = fleetWorkflows(ids());
  const used = new Set<string>();
  for (const agent of FLEET) {
    const own = new Set(agent.toolNames.map((n) => `tool_${n}`));
    for (const n of Object.values(wfs[agent.key].nodes)) {
      if (n.type !== "tool") continue;
      for (const t of n.tools as Array<{ tool_id: string }>) {
        assert(own.has(t.tool_id), `${agent.key}: tool node uses ${t.tool_id}, not in its toolNames`);
        used.add(t.tool_id);
      }
    }
  }
  assertEquals([...used].sort(), TOOL_NAMES.map((n) => `tool_${n}`).sort());
});

Deno.test("fleetWorkflows: a missing workspace tool refuses to build", () => {
  const m = ids();
  m.delete("a4_find_reservation");
  assertThrows(() => fleetWorkflows(m), Error, "workspace missing tool a4_find_reservation");
});

Deno.test("knowledgeFor: the money facts, the typed name and the switch; never 'ticket' or 'nunca toca el dinero'", () => {
  for (const agent of FLEET) {
    const kb = knowledgeFor(agent);
    for (
      const line of [
        "Mesita sí maneja dinero",
        "Créditos de la casa",
        "App Payments",
        "App Prepayments",
        "código que le da el mesero",
        "2% en efectivo y 5% con tarjeta",
        "personas (de 1 a 10), nombre y apellido",
        "La mesa queda a nombre del nombre y apellido escritos en la reservación",
        "interruptor de Reservaciones",
        "si el dueño no puso uno, al número de Google",
        "Nunca des el teléfono del comensal",
      ]
    ) assert(kb.includes(line), `${agent.key}: knowledge lacks «${line}»`);
    assert(kb.includes(agent.roleLines[0]), `${agent.key}: knowledge lacks its role`);
    assert(!/ticket/i.test(kb), `${agent.key}: knowledge says "ticket"`);
    assert(!/nunca toca el dinero/i.test(kb), `${agent.key}: knowledge says Mesita never touches money`);
  }
});

Deno.test("prompts: no agent speaks of tickets or gives the guest's phone", () => {
  const wfs = fleetWorkflows(ids());
  for (const agent of FLEET) {
    const spoken = [agent.prompt, agent.firstMessage, JSON.stringify(wfs[agent.key])].join("\n");
    assert(!/ticket/i.test(spoken), `${agent.key}: says "ticket"`);
    assert(!spoken.includes("{{guest_phone}}"), `${agent.key}: hands out the guest's phone`);
  }
});

Deno.test("fleetWorkflows: no unconditional way back into a tool node (MESITA-4029)", () => {
  // Going back along an edge whose source is a tool node re-runs that
  // webhook. Always open, the model can take it on every turn: a3's place
  // search re-ran ~20 times in 60s and the call never spoke again.
  for (const [key, wf] of Object.entries(fleetWorkflows(ids()))) {
    for (const [id, e] of Object.entries(wf.edges)) {
      if (wf.nodes[e.source as string].type !== "tool" || !e.backward_condition) continue;
      const back = e.backward_condition as { type: string };
      assert(back.type !== "unconditional", `${key}.${id}: unconditional way back into tool node ${e.source}`);
    }
  }
});

Deno.test("a3 place lane: a found table is cancelled only on a yes after the read-back; two searches at most (MESITA-4079)", () => {
  // A cancel before the place answers the read-back loses another guest's
  // table when the answer is "no, esa no" (data loss), and a third search
  // keeps a place on the line asking the same thing.
  const wf = fleetWorkflows(ids()).a3;
  // MESITA-4120: an LLM condition alone was judged on a3's own turn, so every
  // way into a write tool leaves a node that waits for the place to speak.
  const intoWrite = Object.entries(wf.edges).filter(([, e]) =>
    e.target === "place_do_cancel" || e.target === "place_do_change"
  );
  assert(intoWrite.length > 0);
  for (const [id, e] of intoWrite) {
    const fwd = e.forward_condition as { type: string };
    assertEquals(fwd.type, "llm", `a3.${id}: the write is not gated by the place's answer`);
    const from = wf.nodes[e.source as string];
    assertEquals(from.entry_behavior, "wait_for_user", `a3.${id}: leaves ${e.source}, which speaks before the place answers`);
  }
  const finds = Object.entries(wf.nodes).filter(([, n]) =>
    n.type === "tool" && (n.tools as Array<{ tool_id: string }>)[0].tool_id === "tool_a4_find_reservation"
  ).map(([id]) => id);
  assertEquals(finds.sort(), ["place_find", "place_find_again"]);
  const reachesFind = (from: string) =>
    Object.values(wf.edges).some((e) =>
      (e.source === from && finds.includes(e.target as string)) ||
      (e.target === from && finds.includes(e.source as string) && e.backward_condition)
    );
  assert(!reachesFind("place_found_again"), "a3: the second search's node can search a third time");
  assert(!reachesFind("place_answer_again"), "a3: the second search's answer can search a third time");
});
