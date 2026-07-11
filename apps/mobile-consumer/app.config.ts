import type { ConfigContext, ExpoConfig } from 'expo/config';

// Dynamic config — Maps + Sentry DSNs from env at prebuild/EAS time.
// Empty GMP key → SearchMap placeholder; empty Sentry DSN → Sentry.init no-ops.
export default ({ config }: ConfigContext): ExpoConfig => {
  const gmpKey = process.env.EXPO_PUBLIC_GMP_KEY ?? '';
  const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN ?? '';
  const sentryOrg = process.env.SENTRY_ORG ?? 'canzeco';
  const sentryProject =
    process.env.SENTRY_PROJECT ?? 'mesita-mobile-consumer';

  const plugins: ExpoConfig['plugins'] = [
    'expo-router',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#fff7f8',
        image: './assets/images/splash-icon.png',
        imageWidth: 180,
      },
    ],
    'expo-secure-store',
    'expo-dev-client',
  ];

  // Sentry plugin only when org/project are known — source maps upload on EAS
  // needs SENTRY_AUTH_TOKEN in EAS secrets (human). DSN alone is enough for
  // runtime crash capture once EXPO_PUBLIC_SENTRY_DSN is set.
  if (sentryDsn || process.env.SENTRY_AUTH_TOKEN) {
    plugins.push([
      '@sentry/react-native/expo',
      {
        organization: sentryOrg,
        project: sentryProject,
      },
    ]);
  }

  return {
    ...config,
    name: 'Mesita',
    slug: 'mesita-mobile-consumer',
    owner: 'canzeco',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: 'mesita',
    userInterfaceStyle: 'light',
    runtimeVersion: {
      policy: 'appVersion',
    },
    updates: {
      url: 'https://u.expo.dev/e1be2458-e8f7-4626-9828-51eee49bc592',
    },
    ios: {
      icon: './assets/expo.icon',
      bundleIdentifier: 'com.mesita.consumer',
      supportsTablet: false,
      config: gmpKey ? { googleMapsApiKey: gmpKey } : undefined,
    },
    android: {
      package: 'com.mesita.consumer',
      adaptiveIcon: {
        backgroundColor: '#ffffff',
        foregroundImage: './assets/images/android-icon-foreground.png',
        backgroundImage: './assets/images/android-icon-background.png',
        monochromeImage: './assets/images/android-icon-monochrome.png',
      },
      predictiveBackGestureEnabled: false,
      config: gmpKey ? { googleMaps: { apiKey: gmpKey } } : undefined,
    },
    web: {
      output: 'single',
      favicon: './assets/images/favicon.png',
    },
    plugins,
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
    extra: {
      eas: {
        projectId: 'e1be2458-e8f7-4626-9828-51eee49bc592',
      },
      sentryDsn,
    },
  };
};
