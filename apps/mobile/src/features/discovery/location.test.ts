import * as Location from "expo-location";

import { findDevice } from "./screens/location-screen";

jest.mock("expo-location", () => ({
  Accuracy: { Balanced: 3 },
  getCurrentPositionAsync: jest.fn(),
  getLastKnownPositionAsync: jest.fn(),
}));
const now = Location.getCurrentPositionAsync as jest.Mock;
const last = Location.getLastKnownPositionAsync as jest.Mock;

afterEach(() => jest.useRealTimers());

test("a phone with no fix answers with the last place it knew, or fails, never spins", async () => {
  jest.useFakeTimers();
  now.mockReturnValue(new Promise(() => undefined));
  last.mockResolvedValueOnce({ coords: { latitude: 1, longitude: 2 } }).mockResolvedValueOnce(null);
  const found = findDevice();
  await jest.advanceTimersByTimeAsync(10_000);
  expect((await found).coords.latitude).toBe(1);
  const none = expect(findDevice()).rejects.toThrow("no location");
  await jest.advanceTimersByTimeAsync(10_000);
  await none;
});
