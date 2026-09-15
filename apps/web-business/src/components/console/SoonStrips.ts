// THE UNBUILT ENGINES, in one place (MESITA-1852).
//
// House law: an unbuilt engine shows Soon, never knobs, never a fake feed and
// never a fake number. The Soon BADGE lives on the page, never in the rail —
// a dimmed row is the thing MESITA-1833 forbids, so every one of these sits
// behind a row that renders at full strength.
//
// It used to live inside `OrgScreenSections.tsx`, the Payments page's box
// composition. That file is gone (MESITA-1852): its two live boxes are
// Configuration's now, and a composition file for a page that renders only
// Soon strips is a file that drifts from the page it claims to compose.
export const SOON_STRIPS: Record<
  "customers" | "payments" | "brand" | "developers",
  { title: string; line: string }
> = {
  // PREPAID CREDITS LEFT (MESITA-1869). It was a strip because it had no
  // engine; it is a CARD now, in the catalogue, because Mesita Credits is a
  // product an operator buys and a place turns on — and a card whose state is
  // read off `credits_enabled` is not a Soon at all. An entry nobody renders
  // is how a vocabulary starts describing a screen that no longer exists.
  customers: {
    title: "Customers",
    line: "The guests who visit and pay at this organization's places, and what they are worth.",
  },
  // Payments HAS NO PAGE ANY MORE (MESITA-1869) — it is the strip at the
  // foot of the catalogue, which is where a reading of money that has not
  // moved yet belongs: under the products that would move it.
  payments: {
    title: "Payments",
    line: "What guests paid at this organization's places, and what reached its account.",
  },
  brand: {
    title: "Brand",
    line: "The organization's logo, and the colour its loyalty card wears.",
  },
  developers: {
    title: "Developers",
    line: "API keys and what an agent needs to read and drive this organization.",
  },
};
