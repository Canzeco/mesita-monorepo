// The release decision (Docs › Apps › A2 §8). Pure: no network. The fast
// order raises MOBILE_MIN_CONTRACT only when a store release exists, the
// minimum is the published update's own contract number, and enough installs
// can receive that update. Anything else holds or refuses.

export const MIN_REACH_SHARE = 0.9;

const HOLD = "Store release 1 has not shipped. MOBILE_MIN_CONTRACT stays unset.";

/** @param {string} source src/lib/build.ts */
export function readContract(source) {
  const found = source.match(/export const CONTRACT = (\d+);/);
  if (!found) throw new Error("src/lib/build.ts has no CONTRACT number");
  return Number(found[1]);
}

/**
 * @param {{ storeReleased: boolean, contract: number, updateId: string | null, reachable: number | null, total: number | null }} input
 * @returns {{ action: "hold" | "raise" | "refuse", minimum?: number, reason: string }}
 */
export function planRelease(input) {
  if (!input.storeReleased) return { action: "hold", reason: HOLD };
  if (!Number.isInteger(input.contract) || input.contract < 1) {
    return { action: "refuse", reason: "The contract number must be the published update's own." };
  }
  if (!input.updateId) return { action: "refuse", reason: "No published update to read the minimum from." };
  if (input.reachable === null || input.total === null || input.total <= 0) {
    return { action: "refuse", reason: "Install count could not be read. The slow order applies." };
  }
  if (input.reachable / input.total < MIN_REACH_SHARE) {
    return { action: "refuse", reason: "Too few installs can receive this update. The slow order applies." };
  }
  return { action: "raise", minimum: input.contract, reason: `Raise MOBILE_MIN_CONTRACT to ${input.contract}.` };
}
