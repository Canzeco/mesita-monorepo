

let updates: typeof import("./updates");
beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
  updates = jest.requireActual("./updates");
});

const fresh = () => jest.requireMock("expo-updates") as { checkForUpdateAsync: jest.Mock; reloadAsync: jest.Mock };
const MIN = 60_000;

test("an update waits for half an hour away with no task open", () => {
  expect(updates.shouldApply(30 * MIN, true, false)).toBe(true);
  expect(updates.shouldApply(30 * MIN - 1, true, false)).toBe(false);
  expect(updates.shouldApply(60 * MIN, true, true)).toBe(false);
  expect(updates.shouldApply(60 * MIN, false, false)).toBe(false);
});

test("a return finds it and keeps it; a later long absence applies it", async () => {
  fresh().checkForUpdateAsync.mockResolvedValue({ isAvailable: true });
  updates.onLeave(0);
  await updates.onReturn(5 * MIN, false);
  expect(fresh().reloadAsync).not.toHaveBeenCalled();
  updates.onLeave(10 * MIN);
  await updates.onReturn(50 * MIN, true);
  expect(fresh().reloadAsync).not.toHaveBeenCalled();
  updates.onLeave(60 * MIN);
  await updates.onReturn(95 * MIN, false);
  expect(fresh().reloadAsync).toHaveBeenCalledTimes(1);
});

test("nothing new, or no network, changes nothing", async () => {
  fresh().checkForUpdateAsync.mockResolvedValueOnce({ isAvailable: false }).mockRejectedValueOnce(new Error("offline"));
  for (const at of [0, 100]) {
    updates.onLeave(at * MIN);
    await updates.onReturn((at + 40) * MIN, false);
  }
  expect(fresh().reloadAsync).not.toHaveBeenCalled();
});
