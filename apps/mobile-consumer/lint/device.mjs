// The Expo Simulators session that `pnpm sim` starts, as `shot` and `pair`
// drive it. Nothing here prints what a command wrote: a session token, the
// test number and its code pass through these calls.

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

export const ROOT = new URL("..", import.meta.url).pathname;
export const EAS = ["dlx", "eas-cli@27.11.0"];
const DRIVER = ["dlx", "agent-device@0.21.44"];
const SESSION_ENV = `${ROOT}.env.eas-simulator`;
/** What `pnpm sim` started: platform, device, width, build. */
export const SESSION_FILE = `${ROOT}.expo/pair-session.json`;

/** One phone per width. `top` and `bottom` are the safe-area insets in points:
 *  a pair is compared between them. */
export const DEVICES = {
  390: {
    platform: "ios",
    device: "iPhone 17e",
    profile: "simulator",
    top: 47,
    bottom: 34,
  },
  // Expo has no 430 iPhone (its large one is 440) and no 360 Android phone (its
  // smallest is 412): Android is not captured yet (MESITA-5106 names the follow-up).
  440: { platform: "ios", device: "iPhone 17 Pro Max", profile: "simulator", top: 62, bottom: 34 },
};

export class PairError extends Error {
  /** type: the words a caller matches. fix: the command that mends it. */
  constructor(type, message, fix) {
    super(message);
    this.type = type;
    this.fix = fix;
  }
}

export function readSession() {
  if (!existsSync(SESSION_ENV) || !existsSync(SESSION_FILE)) return null;
  return JSON.parse(readFileSync(SESSION_FILE, "utf8"));
}

function sessionEnv() {
  const vars = {};
  for (const line of readFileSync(SESSION_ENV, "utf8").split("\n")) {
    const at = line.indexOf("=");
    if (at > 0 && !line.startsWith("#")) vars[line.slice(0, at)] = line.slice(at + 1).replace(/^(["'])(.*)\1$/, "$2");
  }
  return vars;
}

/** Runs one driver command. Its output is returned, never printed. */
export function device(args, { env = {}, seconds = 60 } = {}) {
  const run = spawnSync("pnpm", [...DRIVER, ...args], {
    cwd: ROOT,
    encoding: "utf8",
    timeout: seconds * 1000,
    env: { ...process.env, ...sessionEnv(), ...env },
  });
  const out = `${run.stdout ?? ""}${run.stderr ?? ""}`;
  const gone =
    /ECONNREFUSED|ENOTFOUND|fetch failed|UNAUTHORIZED|session .*(not found|stopped|expired)|\b40[134]\b|\b50[234]\b/i;
  if (run.status !== 0 && (run.error?.code === "ETIMEDOUT" || gone.test(out))) {
    throw new PairError("NO SIM SESSION", "The simulator session did not answer.", "pnpm sim");
  }
  return { ok: run.status === 0, out };
}

/** Runs eas and returns its JSON, or null. */
export function easJson(args, seconds = 120) {
  const run = spawnSync("pnpm", [...EAS, ...args, "--non-interactive", "--json"], {
    cwd: ROOT,
    encoding: "utf8",
    timeout: seconds * 1000,
  });
  try {
    return JSON.parse(run.stdout.slice(run.stdout.search(/[[{]/)));
  } catch {
    return null;
  }
}

export function exitWith(err) {
  if (!(err instanceof PairError)) throw err;
  console.error(`${err.type}: ${err.message}`);
  if (err.fix) console.error(err.fix);
  process.exit(1);
}
