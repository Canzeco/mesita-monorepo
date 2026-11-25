// pnpm shot /me/profile out.png — open a route in the running Expo Simulators
// session (started by `pnpm sim`) and save a screenshot of it.

import { execFileSync } from "node:child_process";

const [route, output] = process.argv.slice(2);
if (!route?.startsWith("/") || !output) {
  console.error("usage: pnpm shot /route out.png");
  process.exit(1);
}
const scheme = process.env.APP_VARIANT === "preview" ? "mesita" : "mesita-dev";
const exec = (...args) =>
  execFileSync(
    "pnpm",
    ["dlx", "eas-cli@27.11.0", "simulator:exec", "npx", "agent-device@latest", ...args],
    { stdio: "inherit" },
  );
exec("open", `${scheme}://${route}`);
exec("screenshot", output);
