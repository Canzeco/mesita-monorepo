// Run: deno test --allow-read supabase/functions/_shared/reservation-cap.test.ts
//
// Me › Plan tells a guest how many reservations Free allows a month. That
// number is typed in web-consumer (it cannot import from here), so the cap and
// the page are one edit away from disagreeing: someone raises the cap, the page
// keeps promising 10, and a guest plans around a limit that no longer exists.
//
// This is the REQUIRED gate for it: supabase.yml path-filters to
// apps/web-consumer/src/**, so it runs on a PR that touches only the page,
// while web-consumer's own CI is not a required check. It pins the constant
// AND that the page renders from that constant — a literal typed straight into
// the page would otherwise slip past a test that only reads the constant.

import { assert, assertEquals } from "jsr:@std/assert@1";
import { MONTHLY_RESERVATION_CAP } from "./reservation-cap.ts";

const WEB_SRC = new URL("../../../../apps/web-consumer/src/", import.meta.url);

// Comments may quote a number or a name; code is what ships.
const withoutComments = (src: string) =>
  src
    .split("\n")
    .filter((line) => !/^\s*\/\//.test(line))
    .join("\n");

async function read(rel: string): Promise<string> {
  return withoutComments(await Deno.readTextFile(new URL(rel, WEB_SRC)));
}

Deno.test("Me › Plan's Free limit equals the cap the server enforces", async () => {
  const perks = await read("lib/plan-perks.ts");
  const m = perks.match(/export const FREE_RESERVATIONS_PER_MONTH\s*=\s*(\d+)\s*;/);
  if (!m) {
    throw new Error(
      "`export const FREE_RESERVATIONS_PER_MONTH = <integer>;` not found in " +
        "apps/web-consumer/src/lib/plan-perks.ts (moved or retyped?)",
    );
  }
  assertEquals(
    Number(m[1]),
    MONTHLY_RESERVATION_CAP,
    "plan-perks.ts's FREE_RESERVATIONS_PER_MONTH must equal MONTHLY_RESERVATION_CAP",
  );
});

Deno.test("Me › Plan builds that line from the constant, never a typed number", async () => {
  const page = await read("components/consumer/me/PlanModal.tsx");
  assert(
    page.includes('from "@/lib/plan-perks"') &&
      page.includes("${FREE_RESERVATIONS_PER_MONTH} reservations a month"),
    "PlanModal.tsx must import FREE_RESERVATIONS_PER_MONTH and render it in the reservations line",
  );
  assertEquals(
    page.match(/\d+\s+reservations/g),
    null,
    "PlanModal.tsx must not type a reservation count; it comes from plan-perks.ts",
  );
});
