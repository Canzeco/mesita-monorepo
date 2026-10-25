import { assertEquals } from "jsr:@std/assert@1";
import * as server from "./discovery-surface.ts";
import * as admin from "../../../../apps/web-admin/src/app/(app)/filters-config/discovery-surface.ts";

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
