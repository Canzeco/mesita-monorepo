// THE UNBUILT ENGINES, in one place (MESITA-1852).
//
// House law: an unbuilt engine shows Soon, never knobs, never a fake feed and
// never a fake number. The Soon BADGE lives on the page, never in the rail —
// a dimmed row is the thing MESITA-1833 forbids, so every one of these sits
// behind a row that renders at full strength.
//
// It used to live inside `OrgScreenSections.tsx`, the Payments page's box
// composition. That file is gone (MESITA-1852): its two live boxes are
// Settings' now, and a composition file for a page that renders only Soon
// strips is a file that drifts from the page it claims to compose.
//
// THE SUBJECT IS THE PLACE (MESITA-1892). Three of these sentences said "this
// organization's places" — plural, about a holder above the venue. There is no
// holder: a place carries its own guests, its own payments and its own keys.
export const SOON_STRIPS: Record<
  "customers" | "payments" | "developers" | "capital",
  { title: string; line: string }
> = {
  // TERMINAL LEFT WITH ITS PRODUCT (MESITA-1900). MESITA-1885 gave it this
  // strip because the rail listed all eight products and a rail row has to
  // open something real (MESITA-1833); Pato's 2026-09-16 list drops the
  // product, so the row, the page and the strip go together — a strip nobody
  // renders is how a vocabulary starts describing a screen that is gone.
  // PREPAID CREDITS LEFT (MESITA-1869). It was a strip because it had no
  // engine; it is a CARD now, in the catalogue, because Mesita Credits is a
  // product an operator buys and a place turns on — and a card whose state is
  // read off `credits_enabled` is not a Soon at all. An entry nobody renders
  // is how a vocabulary starts describing a screen that no longer exists.
  customers: {
    title: "Customers",
    line: "The guests who visit and pay here, and what they are worth.",
  },
  // Payments HAS NO PAGE ANY MORE (MESITA-1869) — it is the strip at the
  // foot of the catalogue, which is where a reading of money that has not
  // moved yet belongs: under the products that would move it.
  payments: {
    title: "Payments",
    line: "What guests paid here, and what reached this place's account.",
  },
  // BRAND LEFT WITH ITS BOX (MESITA-1870). Pato: *"remove brand configuration
  // from here."* Same rule that moved Prepaid Credits out of this map one
  // issue ago: an entry nobody renders is how a vocabulary starts describing
  // a screen that no longer exists.
  // CAPITAL (MESITA-1929). It is the ninth product and the second Soon: a
  // business model the landing page sells and the console cannot yet deliver.
  // The line says what it IS rather than what it will do, because "not a loan"
  // is the part an owner must not misread.
  capital: {
    title: "Capital",
    line: "Cash now against meals you have not served yet — an advance sale, never a loan.",
  },
  developers: {
    title: "Developers",
    line: "API keys and what an agent needs to read and drive this place.",
  },
};
