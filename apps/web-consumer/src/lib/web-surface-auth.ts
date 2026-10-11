import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { shouldGate } from "@/lib/supabase/middleware";

/** Browse on /web — no phone signup. Account features need the native app. */
export const WEB_GET_THE_APP = "/get-the-app";

export function webRequiresRegisteredAccount(barePathname: string): boolean {
  if (barePathname === WEB_GET_THE_APP) return false;
  if (barePathname.startsWith("/onboard")) return true;
  if (barePathname.startsWith("/auth")) return true;
  return shouldGate(barePathname);
}

export const WEB_HOME = CONSUMER_ROUTES.discoverDefault;
