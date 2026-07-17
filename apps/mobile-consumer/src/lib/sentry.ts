import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

// Crash reporting — no-ops when EXPO_PUBLIC_SENTRY_DSN is unset so local
// web export / unsigned builds stay quiet until the Sentry project exists.
const dsn =
  process.env.EXPO_PUBLIC_SENTRY_DSN ??
  (Constants.expoConfig?.extra?.sentryDsn as string | undefined) ??
  '';

const sentryEnabled = Boolean(dsn);

if (sentryEnabled) {
  Sentry.init({
    dsn,
    enableAutoSessionTracking: true,
    tracesSampleRate: 0.2,
    // Dev client noise — only ship crashes from release/preview builds.
    enabled: !__DEV__,
  });
}

export { Sentry };
