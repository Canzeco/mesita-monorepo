/**
 * @vitest-environment happy-dom
 */
// Money (MESITA-4647): the Offers shop charges exactly the basket on screen,
// once, with the guest's selected saved card; the steppers are locked while
// the charge is out; the receipt is the copy taken at Pay. A declined charge
// keeps the basket; with no usable card Pay opens Add a card and charges
// nothing. A money guard under the MVP test rule, not a layout pin.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PlaceActions, VoucherBasketItem, VoucherBuyOutcome } from "../../actions";
import type { PlaceDetail, PlaceMoney } from "../../place-detail";
import { basketItems, VouchersPane } from "./vouchers";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const MONEY: PlaceMoney = {
  charges_enabled: true,
  mesita_pay: true,
  vouchers: { voucher_welcome: true, voucher_200: true, voucher_1000: true, voucher_5000: true, voucher_vip: false },
  test_mode: false,
  currency: "mxn",
  sell: ["voucher_200", "voucher_1000", "voucher_5000"],
  unavailable: { voucher_welcome: "used" },
  catalog: {
    voucher_200: { price_cents: 20000, bonus_cents: 2000, credit_cents: 22000, available_after_sec: 10800 },
    voucher_5000: { price_cents: 500000, bonus_cents: 150000, credit_cents: 650000, available_after_sec: 10800 },
  },
  balance: { available_cents: 0, pending_cents: 0, held_cents: 0, spendable_cents: 0 },
};

const CARDS = [
  { id: "pm_old", label: "Visa", last4: "1111", exp_month: 1, exp_year: 2099 },
  { id: "pm_pick", label: "Visa", last4: "4242", exp_month: 1, exp_year: 2099 },
];

let root: Root | null = null;

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
});

function mount(actions: PlaceActions) {
  document.body.innerHTML = `<div id="host"></div>`;
  root = createRoot(document.getElementById("host")!);
  const place = { name: "Probe", photos: [], money: MONEY } as unknown as PlaceDetail;
  act(() => {
    root!.render(<VouchersPane place={place} actions={actions} />);
  });
}

const q = (sel: string) => document.querySelector<HTMLButtonElement>(sel);
function plus(key: string) {
  act(() => q(`[data-voucher="${key}"] [data-offer-plus]`)!.click());
}
async function pay() {
  await act(async () => {
    q("[data-offer-pay]")!.click();
  });
}

describe("the Offers shop's charge (MESITA-4647)", () => {
  it("charges the whole basket once with the selected saved card; the receipt is what was sent", async () => {
    const buy = vi.fn(async (_items: VoucherBasketItem[], _card: string | null): Promise<VoucherBuyOutcome> => "paid");
    mount({ onBuyVoucher: buy, payCards: { state: "ready", cards: CARDS }, payCardId: "pm_pick" });
    // An empty basket charges nothing: the bar is there, its button disabled
    // (MESITA-4659), and a tap sends no charge.
    expect(q("[data-offer-pay]")!.disabled).toBe(true);
    expect(q("[data-offer-pay]")!.textContent).toBe("Select an offer");
    await pay();
    expect(buy).not.toHaveBeenCalled();
    plus("voucher_5000");
    plus("voucher_5000");
    plus("voucher_200");
    expect(q("[data-offer-pay]")!.textContent).toContain("$10,200");
    await pay();
    expect(buy).toHaveBeenCalledTimes(1);
    expect(buy).toHaveBeenCalledWith(
      [
        { voucher: "voucher_200", qty: 1 },
        { voucher: "voucher_5000", qty: 2 },
      ],
      "pm_pick",
    );
    const receipt = document.querySelector("[data-offer-receipt]")!;
    expect(receipt.getAttribute("data-offer-receipt")).toBe("paid");
    expect(receipt.textContent).toContain("2 × Big");
    expect(receipt.textContent).toContain("$10,200");
    expect(receipt.textContent).toContain("$13,220");
  });

  it("locks the steppers while the charge is out", async () => {
    let answer: (v: VoucherBuyOutcome) => void = () => {};
    const buy = vi.fn(() => new Promise<VoucherBuyOutcome>((r) => (answer = r)));
    mount({ onBuyVoucher: buy, payCards: { state: "ready", cards: CARDS }, payCardId: "pm_pick" });
    plus("voucher_200");
    act(() => {
      q("[data-offer-pay]")!.click();
    });
    expect(q('[data-voucher="voucher_200"] [data-offer-plus]')!.disabled).toBe(true);
    plus("voucher_200");
    await act(async () => answer("failed"));
    expect(buy).toHaveBeenCalledTimes(1);
    expect(buy).toHaveBeenCalledWith([{ voucher: "voucher_200", qty: 1 }], "pm_pick");
  });

  it("a declined charge keeps the basket; no card opens Add a card and charges nothing", async () => {
    const declined = vi.fn(async (): Promise<VoucherBuyOutcome> => "failed");
    mount({ onBuyVoucher: declined, payCards: { state: "ready", cards: CARDS }, payCardId: "pm_pick" });
    plus("voucher_5000");
    await pay();
    expect(declined).toHaveBeenCalledTimes(1);
    expect(document.querySelector("[data-offer-receipt]")).toBeNull();
    expect(q('[data-voucher="voucher_5000"] [data-offer-qty]')!.textContent).toBe("1");
    act(() => root?.unmount());

    const buy = vi.fn(async (): Promise<VoucherBuyOutcome> => "paid");
    const addCard = vi.fn();
    mount({ onBuyVoucher: buy, onAddPayCard: addCard, payCards: { state: "ready", cards: [] }, payCardId: null });
    plus("voucher_5000");
    await pay();
    expect(buy).not.toHaveBeenCalled();
    expect(addCard).toHaveBeenCalledTimes(1);
    expect(q('[data-voucher="voucher_5000"] [data-offer-qty]')!.textContent).toBe("1");
  });

  it("the basket keeps the server's caps and drops what can't be bought", () => {
    expect(basketItems({ voucher_welcome: 2, voucher_200: 9, voucher_1000: 0, voucher_vip: 1 }, (k) => k !== "voucher_vip")).toEqual([
      { voucher: "voucher_welcome", qty: 1 },
      { voucher: "voucher_200", qty: 5 },
    ]);
  });
});
