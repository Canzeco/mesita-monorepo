import { PageHeader, Card } from "@/components/shell/Page";

export const metadata = { title: "Products" };

// Mesita's five place products (🦚 Main § 4; the landing's PLACE_SOLUTIONS),
// one card of rows (MESITA-3114). Profile and Premier are live and live in
// the rail; the other three are coming, with no forms.
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
    name: "Credit Rewards",
    body: "Fund a percent back on every payment, paid as credit at your place, never cash. You set the rate and the cap; the credit brings the guest back.",
    live: false,
  },
];

export default function ProductsPage() {
  return (
    <div className="flex max-w-3xl flex-col gap-6 pb-8">
      <PageHeader title="Products" sub="What Mesita gives a place, now and next." />
      <Card className="divide-border divide-y p-0 sm:p-0">
        {PRODUCTS.map((p) => (
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
    </div>
  );
}
