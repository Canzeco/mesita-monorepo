// Lints lint/fixture, which breaks every layer rule on purpose, with the same
// layers() the app uses. Each file's first line says exactly what must fire; a
// rule that matches nothing, or too much, fails here.

import { ESLint } from "eslint";
import expoConfig from "eslint-config-expo/flat.js";
import { readFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { layers } from "./layers.mjs";

const app = dirname(dirname(fileURLToPath(import.meta.url)));
const LAYER_RULES = [
  "import/no-restricted-paths",
  "import/no-cycle",
  "no-restricted-imports",
  "no-restricted-syntax",
];
const problems = [];

const eslint = new ESLint({
  cwd: app,
  overrideConfigFile: true,
  overrideConfig: [
    ...expoConfig,
    ...layers("./lint/fixture/src"),
    { settings: { "import/resolver": { typescript: { project: "lint/fixture/tsconfig.json" } } } },
  ],
});

const results = await eslint.lintFiles(["lint/fixture/src/**/*.{ts,tsx}"]);
let wrong = 0;
for (const { filePath, messages } of results) {
  const file = relative(app, filePath);
  const [, spec] = /^\/\/ expect: (.+)/.exec(await readFile(filePath, "utf8")) ?? [null, "nothing"];
  const want = [];
  if (spec !== "nothing") {
    wrong++;
    for (const part of spec.split(", ")) {
      const [rule, times = "1"] = part.split(" ×");
      for (let i = 0; i < Number(times); i++) want.push(rule);
    }
  }
  const have = messages
    .map((m) => (m.ruleId === null && /noInlineConfig|inline config/i.test(m.message) ? "inline-config" : m.ruleId))
    .filter((r) => r === "inline-config" || r === null || LAYER_RULES.includes(r) || r === "import/no-unresolved");
  if (want.sort().join() !== have.sort().join()) {
    problems.push(`${file}: expected ${want.join(", ") || "nothing"}, got ${have.join(", ") || "nothing"}`);
  }
}
if (wrong < 10) problems.push(`only ${wrong} wrong files were linted`);

// The app's own config carries every layer rule as an error.
const own = new ESLint({ cwd: app });
for (const path of ["src/features/pay/queries.ts", "src/features/pay/index.ts"]) {
  const { rules, linterOptions } = await own.calculateConfigForFile(join(app, path));
  for (const rule of LAYER_RULES) {
    const level = [rules?.[rule]].flat()[0];
    if (level !== 2 && level !== "error") problems.push(`eslint.config.mjs: ${rule} is not an error in ${path}`);
  }
  if (!linterOptions?.noInlineConfig) problems.push(`eslint.config.mjs: ${path} may disable a rule inline`);
}

if (problems.length > 0) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log(`layer rule: ${wrong} wrong fixtures refused, as designed`);
