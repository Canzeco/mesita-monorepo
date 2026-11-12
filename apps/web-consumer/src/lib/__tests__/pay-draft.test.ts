import { describe, expect, it } from "vitest";
import { PAY_DRAFT_MAX_AGE_MS, payDraftExpired, readPayDraft, stampPayDraft } from "@/lib/pay-draft";

// Money (MVP test rule): the draft holds the amounts, the method and the
// card a guest is about to pay with. A stale one must not come back as a
// payment half made, a deploy must not empty a live one, and junk in the
// browser's storage must never reach the screen as an amount (MESITA-3759).

const NOW = 1_800_000_000_000;
const saved = (over: Record<string, unknown> = {}) =>
  JSON.stringify({ step: "pay", amount: "1250", tip: 15, other: "", useCredit: false, method: "card", cardId: "pm_1", savedAt: NOW - 1000, ...over });

describe("readPayDraft", () => {
  it("reads a fresh draft whole", () => {
    expect(readPayDraft(saved({ step: "total" }), NOW)).toEqual({
      step: "total",
      amount: "1250",
      tip: 15,
      other: "",
      useCredit: false,
      method: "card",
      cardId: "pm_1",
      savedAt: NOW - 1000,
    });
  });
  it("maps the old step names", () => {
    expect(readPayDraft(saved({ step: "method" }), NOW)?.step).toBe("methods");
    expect(readPayDraft(saved({ step: "review" }), NOW)?.step).toBe("total");
  });
  // MESITA-3798: Pay holds the button that moves money; a draft never
  // reopens there. Saved "pay" and the old "review" open Total, money kept.
  it("a draft never reopens on Pay: pay and review open Total with amounts, tip and method kept", () => {
    for (const step of ["pay", "review"]) {
      expect(readPayDraft(saved({ step }), NOW)).toEqual({
        step: "total",
        amount: "1250",
        tip: 15,
        other: "",
        useCredit: false,
        method: "card",
        cardId: "pm_1",
        savedAt: NOW - 1000,
      });
    }
  });
  it("opens Bill for a step nobody knows, keeping the amounts", () => {
    for (const step of ["sign", "pick", "checkout", 4, null, undefined]) {
      const d = readPayDraft(saved({ step }), NOW);
      expect(d?.step).toBe("bill");
      expect(d?.amount).toBe("1250");
    }
  });
  it("keeps a draft exactly at the limit and drops one just past it", () => {
    expect(readPayDraft(saved({ savedAt: NOW - PAY_DRAFT_MAX_AGE_MS }), NOW)?.amount).toBe("1250");
    expect(readPayDraft(saved({ savedAt: NOW - PAY_DRAFT_MAX_AGE_MS - 1 }), NOW)).toBeNull();
    expect(payDraftExpired(NOW - PAY_DRAFT_MAX_AGE_MS, NOW)).toBe(false);
    expect(payDraftExpired(NOW - PAY_DRAFT_MAX_AGE_MS - 1, NOW)).toBe(true);
  });
  it("the limit is thirty minutes", () => {
    expect(PAY_DRAFT_MAX_AGE_MS).toBe(30 * 60 * 1000);
  });
  it("a draft with no savedAt is stamped now and kept", () => {
    const d = readPayDraft(saved({ savedAt: undefined }), NOW);
    expect(d?.savedAt).toBe(NOW);
    expect(d?.amount).toBe("1250");
    expect(d?.method).toBe("card");
  });
  it("a savedAt in the future is stamped now and kept", () => {
    const d = readPayDraft(saved({ savedAt: NOW + 86_400_000 }), NOW);
    expect(d?.savedAt).toBe(NOW);
    expect(d?.amount).toBe("1250");
  });
  it("garbage is no draft", () => {
    for (const raw of [null, "", "{", "not json", "null", "42", '"text"', "[]", "[1,2]", "true"]) {
      expect(readPayDraft(raw, NOW), String(raw)).toBeNull();
    }
  });
  it("wrong types are no draft", () => {
    expect(readPayDraft(saved({ savedAt: "yesterday" }), NOW)).toBeNull();
    expect(readPayDraft(saved({ savedAt: null }), NOW)).toBeNull();
    expect(readPayDraft(saved({ amount: 1250 }), NOW)).toBeNull();
    expect(readPayDraft(saved({ amount: null }), NOW)).toBeNull();
    expect(readPayDraft(saved({ amount: undefined }), NOW)).toBeNull();
  });
  it("a field of the wrong type falls back to nothing chosen", () => {
    const d = readPayDraft(saved({ tip: "none", other: 5, useCredit: "yes", method: "bitcoin", cardId: 7, step: "bill" }), NOW);
    expect(d).toMatchObject({ tip: null, other: "", useCredit: true, method: null, cardId: null });
  });
  it("an amount the keypad could not have typed never comes back as typed", () => {
    expect(readPayDraft(saved({ amount: "12abc" }), NOW)?.amount).toBe("");
    expect(readPayDraft(saved({ amount: "1,250" }), NOW)?.amount).toBe("1250");
  });
  it("a draft with no tip answer never opens past Tip", () => {
    for (const step of ["methods", "total", "pay", "method", "review"]) {
      expect(readPayDraft(saved({ step, tip: null }), NOW)?.step).toBe("tip");
      expect(readPayDraft(saved({ step, tip: "none" }), NOW)?.step).toBe("tip");
    }
    expect(readPayDraft(saved({ step: "bill", tip: null }), NOW)?.step).toBe("bill");
    expect(readPayDraft(saved({ step: "total", tip: "other", other: "0" }), NOW)?.step).toBe("total");
  });
  it("every write carries its time and reads back", () => {
    const d = { step: "methods" as const, amount: "690", tip: "other" as const, other: "0", useCredit: true, method: null, cardId: null };
    expect(readPayDraft(stampPayDraft(d, NOW), NOW)).toEqual({ ...d, savedAt: NOW });
    expect(readPayDraft(stampPayDraft(d, NOW), NOW + PAY_DRAFT_MAX_AGE_MS + 1)).toBeNull();
  });

  // MESITA-3796: the Ticket step (MESITA-3776) is gone. A draft saved on it,
  // or carrying its fields, keeps the money typed and drops the ticket.
  it("a draft saved on the removed Ticket step opens on Bill with amounts, tip and method kept", () => {
    const raw = saved({ step: "ticket", ticket: "0012", ticketSkipped: false });
    expect(readPayDraft(raw, NOW)).toEqual({
      step: "bill",
      amount: "1250",
      tip: 15,
      other: "",
      useCredit: false,
      method: "card",
      cardId: "pm_1",
      savedAt: NOW - 1000,
    });
  });
  it("a later-step draft carrying ticket fields keeps its step and drops them", () => {
    const d = readPayDraft(saved({ step: "total", ticket: "A-12", ticketSkipped: true }), NOW);
    expect(d?.step).toBe("total");
    expect(d).not.toHaveProperty("ticket");
    expect(d).not.toHaveProperty("ticketSkipped");
  });
});
