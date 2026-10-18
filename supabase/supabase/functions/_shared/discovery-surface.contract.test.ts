import { assertEquals } from "jsr:@std/assert@1";
import * as server from "./discovery-surface.ts";
import * as admin from "../../../../apps/web-admin/src/app/(app)/filters-config/discovery-surface.ts";
import { buildCatalogRails } from "./catalog-rank.ts";
import { CATALOG_RAIL_CAP_DEFAULT } from "./discovery-config.ts";

Deno.test("admin Discovery renders the runtime model, not a second one", () => {
  assertEquals(admin.DISCOVERY_FIELDS, server.DISCOVERY_FIELDS);
  assertEquals(admin.DISCOVERY_FIELD_LABELS, server.DISCOVERY_FIELD_LABELS);
  assertEquals(admin.DISCOVERY_SOURCE_KEYS, server.DISCOVERY_SOURCE_KEYS);
  assertEquals(admin.DISCOVERY_SOURCES, server.DISCOVERY_SOURCES);
  assertEquals(admin.DISCOVERY_SIGNAL_KEYS, server.DISCOVERY_SIGNAL_KEYS);
  assertEquals(admin.DISCOVERY_SIGNALS, server.DISCOVERY_SIGNALS);
  assertEquals(admin.DISCOVERY_GATE_KEYS, server.DISCOVERY_GATE_KEYS);
  assertEquals(admin.DISCOVERY_GATES, server.DISCOVERY_GATES);
  assertEquals(admin.DISCOVERY_PIPELINE_KEYS, server.DISCOVERY_PIPELINE_KEYS);
  assertEquals(admin.DISCOVERY_PIPELINES, server.DISCOVERY_PIPELINES);
  assertEquals(admin.CATALOG_FAMILY_FACTS, server.CATALOG_FAMILY_FACTS);
  for (const p of server.DISCOVERY_PIPELINE_KEYS) {
    for (const sig of server.DISCOVERY_SIGNAL_KEYS) {
      assertEquals(admin.sourcesFeedingSignal(p, sig), server.sourcesFeedingSignal(p, sig));
    }
  }
});

Deno.test("admin Feed rows list the rows buildCatalogRails builds", () => {
  const selected = [{
    id: "a",
    family_keys: server.CATALOG_FAMILY_FACTS.map((f) => f.key),
    enriched_at: "2026-01-01T00:00:00Z",
    content_state: "ready",
  }];
  const rails = buildCatalogRails([{ id: "g:x", googleOnly: true }], selected, CATALOG_RAIL_CAP_DEFAULT);
  assertEquals(
    rails.map((r) => ({ key: r.key, label: r.label, emoji: r.emoji })),
    [
      ...admin.CATALOG_SIGNAL_RAILS.map((r) => ({ key: r.key, label: r.label, emoji: r.emoji })),
      ...admin.CATALOG_FAMILY_FACTS.map((f) => ({ key: f.key, label: f.label, emoji: f.emoji })),
    ],
  );
});
