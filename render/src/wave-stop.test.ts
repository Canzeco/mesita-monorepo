import assert from "node:assert/strict";
import test from "node:test";
import { placesTheWaveDidNotFinish } from "./wave-stop.ts";

test("a killed child in the current wave is stopped with the places not started", () => {
  const jobs = [
    { placeId: "a" },
    { placeId: "b" },
    { placeId: "c" },
    { placeId: "d" },
  ];
  // Wave size 2. `a` finished. `b` was killed before its own stop. `c` and `d` never started.
  assert.deepEqual(placesTheWaveDidNotFinish(jobs, [{ placeId: "a" }]), ["b", "c", "d"]);
});

test("a finished place is left alone", () => {
  assert.deepEqual(
    placesTheWaveDidNotFinish([{ placeId: "a" }, { placeId: "b" }], [{ placeId: "a" }, { placeId: "b" }]),
    [],
  );
});
