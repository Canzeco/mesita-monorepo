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
  "credits" | "customers" | "payments" | "brand" | "developers",
  { title: string; line: string }
> = {
  credits: {
    title: "Prepaid Credits",
    line: "The organization's Credits balance, terms, and outstanding liability will live here.",
  },
  customers: {
    title: "Customers",
    line: "The guests who visit and pay at this organization's places, and what they are worth.",
  },
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
