import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

// Crash reporting — no-ops when EXPO_PUBLIC_SENTRY_DSN is unset so local
// web export / unsigned builds stay quiet until the Sentry project exists.
const dsn =
  process.env.EXPO_PUBLIC_SENTRY_DSN ??
  (Constants.expoConfig?.extra?.sentryDsn as string | undefined) ??
  '';

export const sentryEnabled = Boolean(dsn);

if (sentryEnabled) {
  Sentry.init({
    dsn,
    enableAutoSessionTracking: true,
    tracesSampleRate: 0.2,
    // Dev client noise — only ship crashes from release/preview builds.
    enabled: !__DEV__,
  });
}

/** EF breadcrumb helper — safe no-op when DSN unset (#50). */
export function addEfBreadcrumb(input: {
  fn: string;
  level?: 'info' | 'warning' | 'error';
  status?: number | null;
  code?: string | null;
  message?: string;
}): void {
  if (!sentryEnabled) return;
  Sentry.addBreadcrumb({
    category: 'ef',
    type: 'http',
    level: input.level ?? 'info',
    message: input.message ?? input.fn,
    data: {
      fn: input.fn,
      status: input.status ?? undefined,
      code: input.code ?? undefined,
    },
  });
}

export { Sentry };
