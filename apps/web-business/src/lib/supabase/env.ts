// The Supabase URL and publishable key, read at call time. One reader for
// the browser, server and middleware clients (MESITA-3109).
//
// A value copied from a dashboard that masks secrets arrives as
// `sb_publishable_••••`: fetch() cannot put "•" in a header, auth-js retries
// for ~25 s, and sign-in hangs. Such a value, or a missing one, is logged by
// name and replaced by the committed pair below (MESITA-3110).
//
// Both values are PUBLIC: the publishable key ships in every browser bundle
// and RLS + the Edge Functions guard the data. Never put a secret key here.

export type SupabaseEnv = { url: string; publishableKey: string };

const PUBLIC_SUPABASE: SupabaseEnv = {
  url: "https://yjalywfzdelacdzccpgb.supabase.co",
  publishableKey: "sb_publishable_bQPhz9pZSTnVAW1aOZ6Q6g_imiiwTJd",
};

const PRINTABLE_ASCII = /^[\x21-\x7e]+$/;

function usable(name: string, value: string | undefined): string | null {
  const v = value?.trim();
  if (v && PRINTABLE_ASCII.test(v)) return v;
  console.warn(
    `[business supabase] ${name} is ${v ? "not plain text (a masked copy such as sb_publishable_••••?)" : "missing"}; using the committed public value.`,
  );
  return null;
}

/** The env pair; a missing or masked value falls back to the committed one. */
export function readSupabaseEnv(): SupabaseEnv {
  return {
    url: usable("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL) ?? PUBLIC_SUPABASE.url,
    publishableKey:
      usable("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) ??
      PUBLIC_SUPABASE.publishableKey,
  };
}

/** Same as readSupabaseEnv; kept for the clients that import it. */
export const requireSupabaseEnv = readSupabaseEnv;
