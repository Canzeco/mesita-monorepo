// node scripts/with-env.mjs <profile> expo … — runs Expo with that profile's
// `env` from eas.json, the one source of the app's public config (src/lib/env.ts).

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const [profile, command, ...args] = process.argv.slice(2);
const { build } = JSON.parse(readFileSync(new URL("../eas.json", import.meta.url), "utf8"));
if (!build[profile]?.env || !command) {
  console.error(`usage: with-env.mjs <${Object.keys(build).join("|")}> <command> [args]`);
  process.exit(1);
}
const env = { ...build[profile].env, ...process.env };
process.exit(spawnSync(command, args, { stdio: "inherit", env }).status ?? 1);
