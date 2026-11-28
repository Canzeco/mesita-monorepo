// pnpm shot /me/profile out.png — open a route in the running Expo Simulators
// session (started by `pnpm sim`) and save a screenshot of it.

import { device, exitWith, PairError, readSession } from "./device.mjs";

const [route, output] = process.argv.slice(2);
if (!route?.startsWith("/") || !output) {
  console.error("usage: pnpm shot /route out.png");
  process.exit(1);
}
try {
  const session = readSession();
  if (!session) throw new PairError("NO SIM SESSION", "No simulator session was started here.", "pnpm sim");
  device(["open", "com.mesita.consumer", `mesita:/${route}`, "--platform", session.platform]);
  device(["screenshot", output]);
  console.log(output);
} catch (err) {
  exitWith(err);
}
