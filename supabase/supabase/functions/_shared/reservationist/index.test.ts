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

Deno.test("fleetWorkflows: each agent's tool nodes use only its own tools, and all nine are used", () => {
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
        "Mesita Payments",
        "Mesita Prepayments",
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
