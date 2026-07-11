import type { ConfigContext, ExpoConfig } from 'expo/config';

// Dynamic config so Maps SDK keys come from EXPO_PUBLIC_GMP_KEY at
// prebuild/EAS time (static app.json can't interpolate env). Empty key →
// SearchMap degrades to the branded placeholder; suggest/rail still work.
export default ({ config }: ConfigContext): ExpoConfig => {
  const gmpKey = process.env.EXPO_PUBLIC_GMP_KEY ?? '';

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
    plugins: [
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
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
    extra: {
      eas: {
        projectId: 'e1be2458-e8f7-4626-9828-51eee49bc592',
      },
    },
  };
};
