import { readLink, rememberTarget, setSession } from "@/features/auth";
import { variant } from "@/lib/build";

/** Every incoming link passes here: rewritten to a live route, and handed to
 *  auth, which keeps it only for a guest who is not signed in yet. */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string | null {
  const link = readLink(path, variant !== "production");
  if (link.kind === "ignore") return null;
  if (link.kind === "gate") {
    setSession({ forced: link.gate });
    return "/";
  }
  rememberTarget(link.path);
  return link.path;
}
