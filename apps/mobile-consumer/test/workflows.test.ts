import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..");
const { build } = JSON.parse(readFileSync(join(ROOT, "eas.json"), "utf8"));

test.each(["step-end", "screens", "deliver"])("%s runs with the preview profile's own env", (name) => {
  const text = readFileSync(join(ROOT, `.eas/workflows/${name}.yml`), "utf8");
  for (const [key, value] of Object.entries(build.preview.env)) expect(text).toContain(`      ${key}: "${value}"\n`);
});

test("the two profiles a preview build comes from share one env", () => {
  expect(build.simulator.env).toEqual(build.preview.env);
});
