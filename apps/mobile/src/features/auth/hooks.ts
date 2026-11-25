import { useRouter } from "expo-router";

import { gateOf, type Gate } from "./model";
import { useMyProfile } from "./queries";
import { useSession } from "./store";
import { rememberTarget } from "./target";

/** The two values both layouts guard with. */
export function useGate(): { gate: Gate; member: boolean } {
  const session = useSession();
  const profile = useMyProfile().data;
  return { gate: gateOf(session, profile), member: session.guestId !== null };
}

/** Opens sign-in when the guest has no account, and comes back to `path`.
 *  True when they already have one. */
export function useRequireAccount(): (path: string) => boolean {
  const { guestId } = useSession();
  const router = useRouter();
  return (path) => {
    if (guestId !== null) return true;
    rememberTarget(path);
    router.push("/sign-in");
    return false;
  };
}
