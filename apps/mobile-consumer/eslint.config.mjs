import expoConfig from "eslint-config-expo/flat.js";
import { defineConfig, globalIgnores } from "eslint/config";

import { layers } from "./lint/layers.mjs";

export default defineConfig([
  // Copies written by the repo's generators are checked by sync-shared and tsc;
  // the fixture is wrong on purpose and is linted by lint/check-fixture.mjs.
  globalIgnores(["dist/*", ".expo/*", "src/generated/*", "lint/fixture/*"]),
  expoConfig,
  layers("./src"),
]);
