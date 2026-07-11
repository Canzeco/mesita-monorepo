const CONSUMER_AFTER_AUTH = "/auth/post-signin";

/** Safe in-app path for ?next= (no open redirects). */
export function safeAppPath(raw: string | undefined): string | null {
  if (!raw?.startsWith("/") || raw.startsWith("//")) return null;
  return raw;
}

/**
 * After phone OTP (or a signed-in visit to /?next=…), always run
 * post-signin so consumer-signin-phone stamps role + profile.
 */
export function consumerAuthDestination(raw: string | undefined): string {
  const target = safeAppPath(raw);
  if (!target || target === CONSUMER_AFTER_AUTH) return CONSUMER_AFTER_AUTH;
  return `/auth/post-signin?next=${encodeURIComponent(target)}`;
}
