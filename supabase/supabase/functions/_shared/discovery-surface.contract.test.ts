import { assertEquals } from "jsr:@std/assert@1";
import {
  CATALOG_FAMILY_FACTS,
  DISCOVERY_MODE_KEYS,
  DISCOVERY_MODE_SOURCES,
  DISCOVERY_MODES,
  DISCOVERY_ROUTING_EDITABLE,
  DISCOVERY_SOURCE_KEYS,
  DISCOVERY_SOURCES,
} from "./discovery-surface.ts";
import {
  CATALOG_FAMILY_FACTS as adminFamilies,
  DISCOVERY_MODE_KEYS as adminModes,
  DISCOVERY_MODE_SOURCES as adminRouting,
  DISCOVERY_MODES as adminModeFacts,
  DISCOVERY_ROUTING_EDITABLE as adminEditable,
  DISCOVERY_SOURCE_KEYS as adminSourceKeys,
  DISCOVERY_SOURCES as adminSources,
} from "../../../../apps/web-admin/src/app/(app)/filters-config/discovery-surface.ts";
import {
  CATALOG_ALL_ZERO_ERROR,
  catalogRelativeExponents,
  DEFAULT_CATALOG_RANKING,
} from "./discovery-config.ts";
import {
  CATALOG_ALL_ZERO_ERROR as adminError,
  catalogRelativeExponents as adminExponents,
} from "../../../../apps/web-admin/src/app/(app)/filters-config/catalog-shares.ts";

Deno.test("admin Discovery renders the runtime surface, not a second map", () => {
  assertEquals(adminSourceKeys, DISCOVERY_SOURCE_KEYS);
  assertEquals(adminSources, DISCOVERY_SOURCES);
  assertEquals(adminModes, DISCOVERY_MODE_KEYS);
  assertEquals(adminModeFacts, DISCOVERY_MODES);
  assertEquals(adminRouting, DISCOVERY_MODE_SOURCES);
  assertEquals(adminFamilies, CATALOG_FAMILY_FACTS);
  assertEquals(adminEditable, DISCOVERY_ROUTING_EDITABLE);
  assertEquals(DISCOVERY_ROUTING_EDITABLE, false);
});

Deno.test("admin Catalog shares match the scorer", () => {
  assertEquals(adminError, CATALOG_ALL_ZERO_ERROR);
  const sample = {
    ...DEFAULT_CATALOG_RANKING,
    proximity: 1,
    popularity: 3,
    randomness: 0,
  };
  assertEquals(adminExponents(sample), catalogRelativeExponents(sample));
  const doubled = { ...sample, proximity: 2, popularity: 6 };
  assertEquals(
    catalogRelativeExponents(sample),
    catalogRelativeExponents(doubled),
  );
});
