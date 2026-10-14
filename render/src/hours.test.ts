import assert from "node:assert/strict";
import test from "node:test";
import { closesAtFromHours, weeklyHoursFromPeriods } from "./hours.ts";

test("a weekday period becomes that day's open and close", () => {
  assert.deepEqual(
    weeklyHoursFromPeriods([{ open: { day: 1, hour: 9, minute: 0 }, close: { day: 1, hour: 18, minute: 30 } }]),
    { monday: [{ open: "09:00", close: "18:30" }] },
  );
});

test("one midnight open with no close means every day", () => {
  const hours = weeklyHoursFromPeriods([{ open: { day: 0, hour: 0, minute: 0 } }]);
  assert.equal(hours?.sunday?.[0].close, "23:59");
  assert.equal(hours?.saturday?.[0].open, "00:00");
});

test("a closing line becomes closes_at", () => {
  assert.equal(closesAtFromHours(["Monday: 9:00 AM – 6:30 PM"]), "18:30");
  assert.equal(closesAtFromHours([]), null);
});
