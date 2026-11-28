import { codePhase, connectionLine, hidePayable, type GuestBill } from "./visit";

function bill(patch: Partial<GuestBill>): GuestBill {
  return {
    id: "b",
    state: "sent",
    version: 1,
    currency: "usd",
    billCents: 1000,
    tipCents: 0,
    expiresAt: "2099-01-01T00:00:00Z",
    attemptId: null,
    waiterReady: false,
    tookCents: null,
    place: { id: "p", name: "Place", photo: null },
    quote: {
      outsideCents: 1000,
      creditCents: 0,
      cashbackBps: 0,
      cashbackCents: 0,
    },
    ...patch,
  };
}

test("an open bill with typing is the live bill, not a total to pay", () => {
  expect(codePhase({ closed: false, bill: bill({ state: "open", quote: null }), typing: { billCents: 500, tipCents: 0, step: "bill" }, showQr: false, hideWriting: false })).toBe("writing");
});

test("a sent bill with no quote is not payable", () => {
  expect(codePhase({ closed: false, bill: bill({ quote: null }), typing: null, showQr: false, hideWriting: false })).toBe("over");
});

test("a sent bill is the payment, and accepted waits for the waiter", () => {
  const base = { closed: false, typing: null, showQr: false, hideWriting: false };
  expect(codePhase({ ...base, bill: bill({ state: "sent" }) })).toBe("sent");
  expect(codePhase({ ...base, bill: bill({ state: "accepted" }) })).toBe("accepted");
  expect(codePhase({ ...base, bill: bill({ state: "paid" }) })).toBe("paid");
});

test("a failed re-read hides the payable total", () => {
  expect(hidePayable(1)).toBe(false);
  expect(hidePayable(2)).toBe(true);
});

test("a lost connection while the waiter is ready says not to pay again", () => {
  expect(connectionLine(bill({ state: "accepted", waiterReady: true }))).toBe("Checking… Don't pay again. Ask your waiter if it went through.");
  expect(connectionLine(bill({ state: "sent" }))).toBe("No connection. If it stays, pay normally: nothing was used.");
});
