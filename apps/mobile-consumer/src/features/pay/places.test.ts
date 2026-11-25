import { acceptsCredits, cashbackBps, discountBps, type PayPlace } from "./places";

function place(patch: Partial<PayPlace>): PayPlace {
  return {
    place_id: "p",
    name: "Place",
    photo: null,
    distance_m: null,
    ...patch,
  };
}

test("a discount place prints the discount and not cashback", () => {
  const p = place({
    offers_ok: true,
    offers: { sell: [], visit_mechanism: "discount", welcome_pct: 10 },
  });
  expect(discountBps(p)).toBe(1000);
  expect(cashbackBps(p)).toBe(0);
  expect(acceptsCredits(p)).toBe(false);
});

test("cashback accepts credits", () => {
  const p = place({
    offers_ok: true,
    credits_ok: false,
    offers: { sell: [], visit_mechanism: "cashback", welcome_pct: 5 },
  });
  expect(cashbackBps(p)).toBe(500);
  expect(acceptsCredits(p)).toBe(true);
});

test("a credits flag accepts credits when the percent is off", () => {
  const p = place({ credits_ok: true, offers_ok: true, offers: { sell: [], visit_mechanism: "discount", welcome_pct: 0 } });
  expect(acceptsCredits(p)).toBe(true);
});
