// pnpm sim [--width 390|430|360] [--build <id>] — start the Expo Simulators
// session `pair` and `shot` drive: the phone of that width, holding the newest
// finished build that runs on it (or the one named). It stops by itself after
// 15 idle minutes.

import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";

import { DEVICES, EAS, easJson, exitWith, PairError, ROOT, SESSION_FILE } from "./device.mjs";

const args = process.argv.slice(2);
const flag = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const width = Number(flag("--width") ?? 390);

try {
  const phone = DEVICES[width];
  if (!phone) throw new PairError("WRONG WIDTH", `No phone is ${width} wide.`, "pnpm sim --width 390");
  const buildCommand = `pnpm dlx eas-cli@27.11.0 build --platform ${phone.platform} --profile ${phone.profile} --non-interactive --json`;

  let build = { id: flag("--build"), gitCommitHash: null };
  if (!build.id) {
    const found = easJson([
      "build:list",
      ...["--platform", phone.platform, "--build-profile", phone.profile, "--status", "finished", "--limit", "1"],
    ]);
    if (!found?.[0]) {
      throw new PairError(
        "NO REUSABLE BUILD",
        `No finished ${phone.profile} build for ${phone.platform}.`,
        buildCommand,
      );
    }
    build = found[0];
  }

  // eas writes the session's address and token to .env.eas-simulator itself;
  // its JSON repeats the token, so its output is not shown.
  const start = spawnSync(
    "pnpm",
    [
      ...EAS,
      "simulator:start",
      ...["--platform", phone.platform, "--device", phone.device, "--build-id", build.id],
      ...["--type", "agent-device", "--name", `pair-${width}`],
      ...["--max-idle-time-minutes", "15", "--non-interactive", "--json"],
    ],
    { cwd: ROOT, encoding: "utf8", timeout: 15 * 60 * 1000 },
  );
  let session = null;
  try {
    session = JSON.parse(start.stdout.slice(start.stdout.indexOf("{")));
  } catch {
    // Reported below.
  }
  if (start.status !== 0 || !session?.id) {
    const why = (start.stderr ?? "")
      .split("\n")
      .filter((l) => /error|not|fail/i.test(l))
      .slice(-3)
      .join(" ")
      .trim();
    throw new PairError("NO SIM SESSION", `Expo did not start a ${phone.device}. ${why}`, `pnpm sim --width ${width}`);
  }

  mkdirSync(`${ROOT}.expo`, { recursive: true });
  writeFileSync(
    SESSION_FILE,
    JSON.stringify(
      {
        id: session.id,
        width,
        ...phone,
        buildId: build.id,
        buildCommit: build.gitCommitHash,
      },
      null,
      2,
    ),
  );
  console.log(`sim: ${phone.device} (${width} wide), build ${build.id}`);
  console.log(session.deviceRunSessionUrl);
} catch (err) {
  exitWith(err);
}
