import type { Gate } from "./model";
import { isAppPath } from "./routes";

// The place to return to after sign-in: one value in memory, owned here. It
// survives the code and onboarding and is used once.

let target: string | null = null;
let settled = false;
let member = false;

/** Keep a path with its params. A guest already signed in needs no return. */
export function rememberTarget(path: string): void {
  if (settled && member) return;
  if (isAppPath(path) && !path.startsWith("/sign-in")) target = path;
}

/** The stored session has been read. Until then a link is kept, so a member
 *  opening one on a slow start is not stranded at sign-in. */
export function settleTarget(isMember: boolean): void {
  // A member's link is opened by the router itself: its guards now pass.
  if (!settled && isMember) target = null;
  settled = true;
  member = isMember;
}

/** The target, once, when the gate is open and the guest is a member. */
export function takeTarget(gate: Gate, isMember: boolean): string | null {
  if (gate !== "open" || !isMember || !settled) return null;
  const path = target;
  target = null;
  return path;
}

export function forgetTarget(): void {
  target = null;
}
