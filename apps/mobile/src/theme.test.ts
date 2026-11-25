import { type } from "@/theme";

test("six type roles share five sizes", () => {
  const sizes = new Set(Object.values(type).map((role) => role.fontSize));
  expect([...sizes].sort((a, b) => b - a)).toEqual([24, 18, 16, 14, 13]);
});
