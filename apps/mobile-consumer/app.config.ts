import type { ExpoConfig } from "expo/config";

// Three variants of one app. The development client installs beside the store
// app, so it alone has its own id; preview and production are the same app on
// different update channels.
const VARIANTS = {
  development: { name: "Mesita Dev", id: "com.mesita.consumer.dev", scheme: "mesita-dev" },
  preview: { name: "Mesita Preview", id: "com.mesita.consumer", scheme: "mesita" },
  production: { name: "Mesita", id: "com.mesita.consumer", scheme: "mesita" },
} as const;

const name = process.env.APP_VARIANT ?? "development";
if (!(name in VARIANTS)) {
  throw new Error(`APP_VARIANT "${name}" is not one of ${Object.keys(VARIANTS).join(", ")}`);
}
const variant = VARIANTS[name as keyof typeof VARIANTS];

// Public Google Maps keys, restricted to the app's ids (MESITA-4944). Until
// they exist the map is blank; the native code is the same either way.
const mapsKeys = {
  iosGoogleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_IOS_KEY || "unset",
  androidGoogleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY || "unset",
};

const PROJECT_ID = "e1be2458-e8f7-4626-9828-51eee49bc592";

const config: ExpoConfig = {
  name: variant.name,
  // The slug the EAS project was created with for the previous app.
  slug: "mesita-mobile-consumer",
  owner: "canzeco",
  version: "2.0.0",
  platforms: ["ios", "android"],
  orientation: "portrait",
  userInterfaceStyle: "light",
  scheme: variant.scheme,
  icon: "./assets/icon.png",
  runtimeVersion: { policy: "fingerprint" },
  updates: { url: `https://u.expo.dev/${PROJECT_ID}` },
  ios: {
    bundleIdentifier: variant.id,
    supportsTablet: false,
    // Each screen says its own status bar (statusBarStyle): the photo's is light.
    // Stripe's card scanner links the camera API, so App Store Connect rejects
    // the upload (ITMS-90683) without a camera purpose string (MESITA-5035).
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      UIViewControllerBasedStatusBarAppearance: true,
      NSCameraUsageDescription: "Mesita uses the camera to scan a payment card.",
    },
  },
  android: {
    package: variant.id,
    adaptiveIcon: {
      backgroundColor: "#fb2b7b",
      foregroundImage: "./assets/android-foreground.png",
      monochromeImage: "./assets/android-foreground.png",
    },
  },
  plugins: [
    "expo-router",
    ["expo-splash-screen", { backgroundColor: "#ffffff", image: "./assets/splash.png", imageWidth: 160 }],
    [
      "expo-font",
      {
        ios: {
          fonts: [
            "./assets/fonts/Inter_400Regular.ttf",
            "./assets/fonts/Inter_700Bold.ttf",
            "./assets/fonts/Inter_600SemiBold.ttf",
            "./assets/fonts/Outfit_700Bold.ttf",
          ],
        },
        android: {
          fonts: [
            {
              fontFamily: "Inter",
              fontDefinitions: [
                { path: "./assets/fonts/Inter_400Regular.ttf", weight: 400 },
                { path: "./assets/fonts/Inter_600SemiBold.ttf", weight: 600 },
                { path: "./assets/fonts/Inter_700Bold.ttf", weight: 700 },
              ],
            },
            {
              fontFamily: "Outfit",
              fontDefinitions: [{ path: "./assets/fonts/Outfit_700Bold.ttf", weight: 700 }],
            },
          ],
        },
      },
    ],
    // Stripe's iOS SDK and Google Maps share one binary: dynamic frameworks.
    // On Android, the code shrinker stops on the classes of a Stripe feature
    // Mesita does not use (Issuing push provisioning), which are not installed.
    [
      "expo-build-properties",
      {
        ios: { useFrameworks: "dynamic" },
        android: { extraProguardRules: "-dontwarn com.stripe.android.pushProvisioning.**" },
      },
    ],
    // The Apple Pay merchant id arrives with the Wallet step.
    ["@stripe/stripe-react-native", { merchantIdentifier: [], enableGooglePay: true }],
    "./plugins/with-stripe-release-lint.js",
    "expo-notifications",
    "expo-secure-store",
    "expo-sqlite",
    "expo-localization",
    "expo-web-browser",
    ["expo-location", { locationWhenInUsePermission: "Mesita uses your location to show the places near you." }],
    // Source maps are uploaded by the pipeline (1d), which holds the token.
    ["@sentry/react-native/expo", { organization: "canzeco", project: "mesita-mobile" }],
    ["react-native-maps", mapsKeys],
  ],
  experiments: { typedRoutes: true, reactCompiler: true },
  extra: { variant: name, eas: { projectId: PROJECT_ID } },
};

export default config;
