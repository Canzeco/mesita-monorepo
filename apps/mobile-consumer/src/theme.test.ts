import { type } from "@/theme";

test("type sizes are the web's steps", () => {
  const sizes = [...new Set(Object.values(type).map((role) => role.fontSize))].sort((a, b) => b - a);
  expect(sizes).toEqual([32, 30, 24, 18, 16, 14, 13, 12, 11, 10]);
});
