// One gift, one page (MESITA-4066): a gift line finds its gift by the
// gift_id the server sends, never by amount, so two same-amount gifts at one
// place can never swap pages; the receiver's held credit reads "ready in".
import { describe, expect, it } from "vitest";
import type { GiftTicket } from "@/lib/api/wallet";
import { findGift, giftOfEntry, giftState } from "@/lib/gift-ticket";

const NOW = Date.parse("2026-11-15T12:00:00Z");
const person = (name: string, you = false) => ({ name, photo: null, you });
const gift = (x: Partial<GiftTicket> & Pick<GiftTicket, "gift_id">): GiftTicket => ({
  place_id: "p1",
  place: null,
  amount_cents: 300,
  currency: "mxn",
  status: "open",
  role: "sender",
  created_at: "2026-11-15T10:00:00Z",
  claimed_at: null,
  taken_back_at: null,
  sender: person("You", true),
  recipient: null,
  entry: null,
  ...x,
});

describe("giftOfEntry", () => {
  // Two gifts of the same amount at one place: the amount pairing this
  // replaced could open either.
  const wallet = { gifts: [gift({ gift_id: "g1" }), gift({ gift_id: "g2", status: "taken_back" })] };

  it("finds a gift line's gift by its gift_id", () => {
    expect(giftOfEntry(wallet, { kind: "gift_back", gift_id: "g2" })?.gift_id).toBe("g2");
    expect(giftOfEntry(wallet, { kind: "gift_out", gift_id: "g1" })?.gift_id).toBe("g1");
  });

  it("is null for a line that is not a gift's, a line without gift_id, or a gift past the read", () => {
    expect(giftOfEntry(wallet, { kind: "voucher", gift_id: "g1" })).toBeNull();
    expect(giftOfEntry(wallet, { kind: "gift_out" })).toBeNull();
    expect(giftOfEntry(wallet, { kind: "gift_out", gift_id: null })).toBeNull();
    expect(giftOfEntry(wallet, { kind: "gift_in", gift_id: "gone" })).toBeNull();
    expect(giftOfEntry({}, { kind: "gift_in", gift_id: "g1" })).toBeNull();
  });

  it("findGift is by id only", () => {
    expect(findGift(wallet, "g2")?.status).toBe("taken_back");
    expect(findGift(wallet, "nope")).toBeNull();
  });
});

describe("giftState", () => {
  it("reads each status", () => {
    expect(giftState(gift({ gift_id: "a" }), NOW).label).toBe("Waiting for a friend");
    expect(giftState(gift({ gift_id: "a", status: "taken_back" }), NOW).label).toBe("Taken back");
    expect(giftState(gift({ gift_id: "a", status: "claimed" }), NOW)).toEqual({ label: "Taken", tone: "green" });
  });

  it("a receiver's credit still on hold reads Taken · ready in 1 hr; once it lands, Taken", () => {
    const g = gift({
      gift_id: "a",
      status: "claimed",
      role: "recipient",
      entry: { kind: "gift_in", at: "2026-11-15T12:00:00Z", available_at: "2026-11-15T13:00:00Z" },
    });
    expect(giftState(g, NOW)).toEqual({ label: "Taken · ready in 1 hr", tone: "ink" });
    expect(giftState(g, Date.parse("2026-11-15T13:00:01Z")).label).toBe("Taken");
  });

  it("the sender's lines never read a hold", () => {
    const g = gift({
      gift_id: "a",
      status: "claimed",
      entry: { kind: "gift_out", at: "2026-11-15T10:00:00Z", available_at: "2026-11-15T13:00:00Z" },
    });
    expect(giftState(g, NOW).label).toBe("Taken");
  });
});
