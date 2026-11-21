import { describe, expect, it } from "vitest";
import { ticketLine, ticketStatus, ticketWhen, voucherName, type GiftTicket, type StoryTicket, type VisitTicket, type VoucherTicket } from "@/lib/ticket-desk";

const at = "2026-11-20T12:00:00Z";
const base = { id: "1", at, rank: 0, guest: "Ana" };

const visit = (over: Partial<VisitTicket> = {}): VisitTicket => ({
  ...base,
  status: "paid",
  open: false,
  origin: "waiter",
  bill_cents: 10000,
  tip_cents: 0,
  ticket: "14",
  waiter_name: "Luis",
  ...over,
});

describe("ticket desk words", () => {
  it("prints a log time in the place timezone", () => {
    expect(ticketWhen("2026-11-20T18:00:00Z", "America/Mexico_City")).toBe("Nov 20, 12:00 PM");
  });

  it("names the voucher products", () => {
    expect(voucherName("voucher_story")).toBe("Story Voucher");
    expect(voucherName("voucher_welcome")).toBe("Welcome Voucher");
    expect(voucherName(null)).toBe("Voucher");
  });

  it("says a posted story needs a look, and a void says why", () => {
    const found: StoryTicket = { ...base, state: "found", void_reason: null, bonus_cents: 4000, deadline_at: at };
    expect(ticketStatus("stories", found)).toBe("Needs a look");
    expect(ticketLine("stories", found)).toContain("look");
    const expired: StoryTicket = { ...found, state: "void", void_reason: "expired" };
    expect(ticketStatus("stories", expired)).toBe("Expired");
  });

  it("says a visit is Open or Paid, with the waiter and the ticket", () => {
    expect(ticketStatus("visits", visit({ status: "waiting_bill", open: true }))).toBe("Open");
    expect(ticketLine("visits", visit())).toBe("Luis · Ticket 14");
  });

  it("says a voucher was refunded and a gift is still an open link", () => {
    const voucher: VoucherTicket = { ...base, status: "partly_refunded", voucher: "voucher_200", amount_cents: 20000, bonus_cents: 2000, refunded_cents: 5000 };
    expect(ticketStatus("vouchers", voucher)).toBe("Partly refunded");
    expect(ticketLine("vouchers", voucher)).toBe("Small Voucher");
    const gift: GiftTicket = { ...base, status: "open", amount_cents: 5000, currency: "mxn", other: null };
    expect(ticketStatus("gifts", gift)).toBe("Open link");
    expect(ticketLine("gifts", gift)).toBe("Waiting for a friend.");
  });
});
