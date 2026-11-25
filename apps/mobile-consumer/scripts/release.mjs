// The release workflow's step. Before store release 1 it holds: it publishes
// nothing and leaves MOBILE_MIN_CONTRACT unset. After it, the fast order is
// planRelease's, and a refusal exits 1 so the minimum is not raised.

import { readFileSync } from "node:fs";

import { planRelease, readContract } from "./release-order.mjs";

const source = readFileSync(new URL("../src/lib/build.ts", import.meta.url), "utf8");
const decision = planRelease({
  storeReleased: process.env.MOBILE_STORE_RELEASE === "1",
  contract: readContract(source),
  updateId: process.env.MOBILE_STORE_RELEASE === "1" ? process.env.RELEASE_UPDATE_ID ?? null : null,
  reachable: null,
  total: null,
});

if (decision.action === "raise") {
  console.error("The raise is refused until the install count is read from Expo. The slow order applies.");
  process.exit(1);
}

console.log(decision.reason);
process.exit(decision.action === "refuse" ? 1 : 0);
