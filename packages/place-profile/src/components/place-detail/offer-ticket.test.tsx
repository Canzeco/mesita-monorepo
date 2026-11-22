/**
 * @vitest-environment happy-dom
 */
// Money (MESITA-4630): the voucher ticket charges exactly one unit of the
// chosen voucher with the guest's selected saved card, only from its Pay
// step, and only once Credits shows a charge that answered. A declined charge
// stays on Pay; with no usable card Pay opens Add a card and charges nothing.
// A money guard under the MVP test rule, not a layout pin.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PlaceActions, VoucherBasketItem, VoucherBuyOutcome } from "../../actions";
import type { PlaceDetail, PlaceMoney } from "../../place-detail";
import { OfferTicket, type OfferTicketFrame } from "./vouchers";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const MONEY: PlaceMoney = {
  charges_enabled: true,
  mesita_pay: true,
  vouchers: { voucher_200: true, voucher_1000: true, voucher_5000: true, voucher_vip: false },
  test_mode: false,
  currency: "mxn",
  sell: ["voucher_200", "voucher_1000", "voucher_5000"],
  unavailable: {},
  catalog: {
    voucher_5000: { price_cents: 500000, bonus_cents: 150000, credit_cents: 650000, available_after_sec: 10800 },
  },
  balance: { available_cents: 0, pending_cents: 0, held_cents: 0, spendable_cents: 0 },
};

const CARDS = [
  { id: "pm_old", label: "Visa", last4: "1111", exp_month: 1, exp_year: 2099 },
  { id: "pm_pick", label: "Visa", last4: "4242", exp_month: 1, exp_year: 2099 },
];

let root: Root | null = null;
let last: OfferTicketFrame | null = null;

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  last = null;
  document.body.innerHTML = "";
});

function mount(actions: PlaceActions) {
  document.body.innerHTML = `<div id="host"></div>`;
  root = createRoot(document.getElementById("host")!);
  const place = { name: "Probe", photos: [], money: MONEY } as unknown as PlaceDetail;
  act(() => {
    root!.render(
      <OfferTicket
        place={place}
        actions={actions}
        productKey="voucher_5000"
        frame={(f) => {
          last = f;
          return <div>{f.body}</div>;
        }}
        onFinish={() => {}}
        onMissing={() => {}}
      />,
    );
  });
}

async function press() {
  await act(async () => {
    last!.primary!.onClick();
  });
}

describe("the voucher ticket's charge (MESITA-4630)", () => {
  it("charges one unit of the chosen voucher with the selected saved card, from Pay only", async () => {
    const buy = vi.fn(async (_items: VoucherBasketItem[], _card: string | null): Promise<VoucherBuyOutcome> => "paid");
    mount({ onBuyVoucher: buy, payCards: { state: "ready", cards: CARDS }, payCardId: "pm_pick" });
    expect(last!.step).toBe(1);
    await press(); // Continue
    expect(buy).not.toHaveBeenCalled();
    expect(last!.step).toBe(2);
    await press(); // Pay
    expect(buy).toHaveBeenCalledTimes(1);
    expect(buy).toHaveBeenCalledWith([{ voucher: "voucher_5000", qty: 1 }], "pm_pick");
    expect(last!.step).toBe(3);
    expect(last!.paid).toBe(true);
  });

  it("a declined charge stays on Pay; no card opens Add a card and charges nothing", async () => {
    const declined = vi.fn(async (): Promise<VoucherBuyOutcome> => "failed");
    mount({ onBuyVoucher: declined, payCards: { state: "ready", cards: CARDS }, payCardId: "pm_pick" });
    await press();
    await press();
    expect(declined).toHaveBeenCalledTimes(1);
    expect(last!.step).toBe(2);
    expect(last!.paid).toBe(false);
    act(() => root?.unmount());

    const buy = vi.fn(async (): Promise<VoucherBuyOutcome> => "paid");
    const addCard = vi.fn();
    mount({ onBuyVoucher: buy, onAddPayCard: addCard, payCards: { state: "ready", cards: [] }, payCardId: null });
    await press();
    await press();
    expect(buy).not.toHaveBeenCalled();
    expect(addCard).toHaveBeenCalledTimes(1);
    expect(last!.step).toBe(2);
  });
});
