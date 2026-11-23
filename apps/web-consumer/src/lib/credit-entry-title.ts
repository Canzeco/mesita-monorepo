// A CREDIT ENTRY PAGE'S HEADER NAMES ITS KIND (MESITA-4258, Pato: "call this
// shit Voucher … you are calling them credit and that's wrong in the header
// … call gifts gift"): read from the entry key in the URL ("voucher.<ms>"),
// so the loading frame and the page say the same word. Visits and gift links
// have their own pages, already "Visit" and "Gift".

const TITLE: Record<string, string> = {
  voucher: "Voucher",
  prepay: "Voucher",
  bonus: "Voucher",
  cashback: "Cashback",
  gift_in: "Gift",
  gift_out: "Gift",
  gift_back: "Gift",
  reversal: "Refund",
  refund: "Refund",
};

/** The header for /me/tickets/credit/<placeId>/<kind>.<ms>. */
export function creditEntryTitle(entryKey: string | undefined): string {
  const kind = decodeURIComponent(entryKey ?? "").split(".")[0];
  return TITLE[kind] ?? "Credit";
}
