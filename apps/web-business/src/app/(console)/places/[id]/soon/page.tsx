import { Card } from "@/components/shell/Page";

export const metadata = { title: "Soon" };

// The one page about what is not on yet (MESITA-3197, Pato: "in capabilities
// create a page called soon and there write everything inside, like all the
// brainstorm"). One card of rows in launch order, each a name and one plain
// line, as Settings and Team draw theirs (MESITA-3196). Copy only: no forms,
// no dates, no sign-up. When a product ships, its row leaves and it becomes
// its own page; the lines mirror Main §3, §4 and §13.
const ROW = "flex min-h-14 items-center gap-3 px-5 py-3 text-sm sm:px-6";

const SOON: Array<{ name: string; line: string }> = [
  {
    name: "Products",
    line: "What you sell, on your page for guests to see.",
  },
  {
    name: "Payments",
    line: "The guest pays the bill from their phone into your own Stripe account. Card, Apple Pay and Google Pay.",
  },
  {
    name: "Prepayments",
    line: "Guests buy your meals ahead at a bonus you set, gift them or send them. You get the money when they buy.",
  },
  {
    name: "Credits",
    line: "Rewards paid as credit for the next visit instead of a discount today.",
  },
  {
    name: "Reservations",
    line: "Mesita's agent phones you and books the table for the guest.",
  },
  {
    name: "Mesita Business on the phone",
    line: "This console as an app.",
  },
];

export default function SoonPage() {
  return (
    <div className="flex flex-col gap-4 pb-8">
      <Card className="flex flex-col p-0 sm:p-0">
        <h2 className="px-5 pt-4 pb-2 font-semibold sm:px-6">Soon</h2>
        <ul className="divide-border divide-y">
          {SOON.map((s) => (
            <li key={s.name} className={ROW}>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{s.name}</p>
                <p className="text-muted-foreground">{s.line}</p>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
