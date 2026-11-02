// The Supabase URL and publishable key, read at call time (the build's
// page-data pass runs without them). One reader for the browser, server and
// middleware clients (MESITA-3109).
//
// A value copied from a dashboard that masks secrets arrives as
// `sb_publishable_••••`: fetch() cannot put "•" in a header, auth-js retries
// for ~25 s, and sign-in hangs with no clear error. Such a value is refused
// here, by name, so the cause is the first line in the logs.

export type SupabaseEnv = { url: string; publishableKey: string };

const PRINTABLE_ASCII = /^[\x21-\x7e]+$/;

/** The env pair, or the reason it cannot be used. */
export function readSupabaseEnv(): SupabaseEnv | { error: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !publishableKey) {
    return {
      error:
        "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. " +
        "Set both in Vercel env and in .env.local.",
    };
  }
  for (const [name, value] of [
    ["NEXT_PUBLIC_SUPABASE_URL", url],
    ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", publishableKey],
  ] as const) {
    if (!PRINTABLE_ASCII.test(value)) {
      return {
        error:
          `${name} holds characters a request header cannot carry ` +
          "(a masked copy such as sb_publishable_••••?). Paste the real value in Vercel and redeploy.",
      };
    }
  }
  return { url, publishableKey };
}

/** The env pair; throws with the reason when it cannot be used. */
export function requireSupabaseEnv(): SupabaseEnv {
  const env = readSupabaseEnv();
  if ("error" in env) throw new Error(env.error);
  return env;
}
