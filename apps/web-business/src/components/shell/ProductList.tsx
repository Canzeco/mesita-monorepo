import { Card } from "@/components/shell/Page";

// Mesita's place products (🦚 Main § 4, the landing's PLACE_SOLUTIONS, plus Menu since MESITA-3152),
// one card of rows. Since MESITA-3128 the place's Future page lists the ones
// still coming (Profile and Premier have their own menu rows).
const PRODUCTS: Array<{ name: string; body: string; live: boolean }> = [
  {
    name: "Mesita Profile",
    body: "Your page, built from your Google listing and public sources. Claim it to control photos, hours, channels and how guests read you. Free forever.",
    live: true,
  },
  {
    name: "Premier Boost",
    body: "The one paid mark in Mesita. 2X or 5X multiplies your score in every Discovery search, always marked Ad. It orders, never excludes. Cancel any month.",
    live: true,
  },
  {
    name: "Digital Payments",
    body: "Card, Apple Pay and Google Pay on your own Stripe account, opened in minutes. Funds settle to you; you are the merchant of record.",
    live: false,
  },
  {
    name: "Credit Prepayments",
    body: "Sell meals before they are eaten. Set the bonus; guests buy, gift and send credit that spends only with you, and you get the money the day it is bought.",
    live: false,
  },
  {
    name: "Mesita Menu",
    body: "Your menu on your profile: dishes, prices and photos guests read before they come, kept in step with what you serve.",
    live: false,
  },
  {
    name: "Credit Rewards",
    body: "Fund a percent back on every payment, paid as credit at your place, never cash. You set the rate and the cap; the credit brings the guest back.",
    live: false,
  },
];

/** All of them, or just the named ones (a Soon page shows its own product). */
export function ProductList({ only }: { only?: readonly string[] }) {
  const rows = only ? PRODUCTS.filter((p) => only.includes(p.name)) : PRODUCTS;
  return (
    <section className="flex flex-col gap-3">
      {only ? null : <h2 className="text-lg font-semibold tracking-tight">Products</h2>}
      <Card className="divide-border divide-y p-0 sm:p-0">
        {rows.map((p) => (
          <div key={p.name} className="flex items-start gap-4 px-5 py-4">
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{p.name}</p>
              <p className="text-muted-foreground mt-0.5 text-sm leading-relaxed">{p.body}</p>
            </div>
            <span
              className={
                p.live
                  ? "bg-foreground text-background shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold"
                  : "bg-muted text-muted-foreground shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold"
              }
            >
              {p.live ? "Live" : "Soon"}
            </span>
          </div>
        ))}
      </Card>
    </section>
  );
}
