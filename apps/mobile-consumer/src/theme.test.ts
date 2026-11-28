import { radius, text, type } from "@/theme";

test("corners are the web's scale, by the web's names", () => {
  expect(radius).toEqual({ base: 4, sm: 5, md: 6, lg: 8, xl: 10, "2xl": 12, "3xl": 14, panel: 24, full: 9999 });
});

test("every role is one of the web's text sizes", () => {
  const web = new Set(Object.values(text).map((step) => step.fontSize));
  const phone = Object.entries(type).filter(([name]) => !["hero", "cover", "wordmark", "coverWordmark"].includes(name));
  for (const [, role] of phone) expect(web).toContain(role.fontSize);
});
