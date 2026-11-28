import { readFileSync } from "node:fs";
import { join } from "node:path";

import { forcedFetch, forcedPairState, forcePairState, PAIR_STATES_ON, readPairState } from "@/lib/pair-state";

const { build } = JSON.parse(readFileSync(join(__dirname, "../../eas.json"), "utf8"));

test("the store profile never sets the constant", () => {
  expect(build.production.env).not.toHaveProperty("EXPO_PUBLIC_PAIR_STATES");
});

test("without the constant nothing can be forced", () => {
  expect(PAIR_STATES_ON).toBe(false);
  const real = jest.fn();
  expect(forcedFetch(real)).toBe(real);
  expect(readPairState("mesita://pay?pairState=error")).toEqual({
    link: "mesita://pay?pairState=error",
    state: "main",
  });
  expect(forcePairState("error")).toBe(false);
  expect(forcedPairState()).toBe("main");
});
