// What a phone has and jest does not.

process.env.EXPO_PUBLIC_SUPABASE_URL = "https://stub.supabase.co";
process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "public-key";

jest.mock("expo-sqlite/kv-store", () => {
  const items = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      items,
      getItem: async (k: string) => items.get(k) ?? null,
      setItem: async (k: string, v: string) => void items.set(k, v),
      removeItem: async (k: string) => void items.delete(k),
    },
  };
});

jest.mock("expo-secure-store", () => {
  const items = new Map<string, string>();
  return {
    AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 1,
    getItemAsync: async (k: string) => items.get(k) ?? null,
    setItemAsync: async (k: string, v: string) => void items.set(k, v),
  };
});

jest.mock("expo-crypto", () => {
  const node = jest.requireActual("node:crypto");
  return { getRandomValues: (a: Uint8Array) => node.webcrypto.getRandomValues(a), randomUUID: () => node.randomUUID() };
});

jest.mock("@sentry/react-native", () => ({ init: jest.fn(), captureException: jest.fn() }));

jest.mock("expo-updates", () => ({
  isEnabled: true,
  isEmergencyLaunch: false,
  updateId: "update-1",
  checkForUpdateAsync: jest.fn(async () => ({ isAvailable: false })),
  fetchUpdateAsync: jest.fn(async () => ({})),
  reloadAsync: jest.fn(async () => undefined),
}));

jest.mock("expo-network", () => ({ addNetworkStateListener: () => ({ remove: () => undefined }) }));
jest.mock("expo-haptics", () => ({ selectionAsync: async () => undefined }));
jest.mock("expo-web-browser", () => ({ openBrowserAsync: jest.fn(async () => ({ type: "opened" })) }));
jest.mock("expo/fetch", () => ({ fetch: jest.fn() }));
jest.mock("react-native-safe-area-context", () => jest.requireActual("react-native-safe-area-context/jest/mock").default);
