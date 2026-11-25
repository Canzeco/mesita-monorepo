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
  last.mockResolvedValueOnce({ coords: { latitude: 1, longitude: 2 } });
  const found = findDevice();
  await jest.advanceTimersByTimeAsync(10_000);
  expect((await found).coords.latitude).toBe(1);

  now.mockReturnValue(new Promise(() => undefined));
  last.mockResolvedValueOnce(null);
  const none = expect(findDevice()).rejects.toThrow("no location");
  await jest.advanceTimersByTimeAsync(20_000);
  await none;

  let finish: (place: unknown) => void = () => undefined;
  now.mockReturnValue(new Promise((done) => (finish = done)));
  last.mockResolvedValueOnce(null);
  const late = findDevice();
  await jest.advanceTimersByTimeAsync(10_000);
  finish({ coords: { latitude: 3, longitude: 4 } });
  expect((await late).coords.latitude).toBe(3);
});
