// The app's public config. One source: `env` of each profile in eas.json,
// which builds, updates, CI and local runs all read. Checked at startup, so a
// build with no backend address fails with the missing name.

type Vars = Record<string, string | undefined>;

export function readEnv(vars: Vars) {
  const need = (name: string) => {
    const value = vars[name]?.trim();
    if (!value) throw new Error(`Missing ${name}: add it to every profile's env in eas.json.`);
    return value;
  };
  return {
    supabaseUrl: need("EXPO_PUBLIC_SUPABASE_URL"),
    supabaseKey: need("EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    /** Without it nothing is reported. */
    sentryDsn: vars.EXPO_PUBLIC_SENTRY_DSN?.trim() || null,
  };
}

// Expo inlines only the literal `process.env.NAME` form.
export const env = readEnv({
  EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  EXPO_PUBLIC_SENTRY_DSN: process.env.EXPO_PUBLIC_SENTRY_DSN,
});
