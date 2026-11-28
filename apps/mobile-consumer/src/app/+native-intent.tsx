import { readLink, rememberTarget, setSession } from "@/features/auth";
import { variant } from "@/lib/build";
import { forcePairState, readPairState } from "@/lib/pair-state";
import { queryClient } from "@/lib/query";

/** Every incoming link passes here: rewritten to a live route, and handed to
 *  auth, which keeps it only for a guest who is not signed in yet. */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string | null {
  // `pnpm pair` forces a state with a link; the store build has no such link.
  const pair = readPairState(path);
  if (forcePairState(pair.state)) void queryClient.resetQueries();
  const link = readLink(pair.link, variant !== "production");
  if (link.kind === "ignore") return null;
  if (link.kind === "gate") {
    setSession({ forced: link.gate });
    return "/";
  }
  rememberTarget(link.path);
  return link.path;
}
