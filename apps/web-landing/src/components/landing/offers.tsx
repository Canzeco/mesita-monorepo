// 🦚 Main § 7, Voucher Offers (MESITA-4994). One product, four settings:
// price, bonus, who qualifies, how often. Classic first, then the specials.
// Guest words: credit and bonus.
const OFFERS = [
  {
    name: "Small",
    who: "Any guest",
    pay: "MX$200",
    now: "MX$200",
    bonus: "+MX$20",
    pct: "+10%",
  },
  {
    name: "Medium",
    who: "Any guest",
    pay: "MX$1,000",
    now: "MX$1,000",
    bonus: "+MX$200",
    pct: "+20%",
  },
  {
    name: "Big",
    who: "Any guest",
    pay: "MX$5,000",
    now: "MX$5,000",
    bonus: "+MX$1,500",
    pct: "+30%",
  },
  {
    name: "Welcome",
    who: "New to the place, once",
    pay: "MX$100",
    now: "MX$100",
    bonus: "+MX$100",
    pct: "+100%",
  },
  {
    name: "VIP",
    who: "VIP code, once per visit",
    pay: "MX$100",
    now: "MX$100",
    bonus: "+MX$100",
    pct: "+100%",
  },
];

const RULES = [
  {
    title: "Your money now, the bonus in 3 hours.",
    body: "What the guest pays is ready the moment the voucher sells and can pay that night’s bill. The bonus lands 3 hours later, so it always pays for a return visit.",
  },
  {
    title: "All credit behaves the same.",
    body: "It spends only at that place, never expires, and can be sent to another guest. Transfers are free.",
  },
  {
    title: "The place is paid when the voucher sells.",
    body: "Minus Mesita’s 5% fee. It stays in control through the credit limit in the Credits module.",
  },
];

function Offers() {
  return (
    <section id="offers" className="border-border scroll-mt-16 border-b">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-5 py-20 md:py-24">
        <div className="flex max-w-3xl flex-col gap-4">
          <p className="text-secondary text-xs font-semibold tracking-[0.18em] uppercase">
            Voucher Offers
          </p>
          <h2 className="font-display text-3xl font-semibold tracking-tight md:text-5xl">
            Pay MX$1,000. Get MX$1,200.
          </h2>
          <p className="text-muted-foreground text-base leading-relaxed md:text-lg">
            Every voucher is the same product with four settings: price, bonus,
            who qualifies, and how often.
          </p>
        </div>

        <div className="border-border bg-card shadow-elev overflow-hidden rounded-3xl border">
          <table className="w-full text-left text-[15px]">
            <thead>
              <tr className="text-muted-foreground border-border border-b text-xs font-semibold tracking-wide uppercase">
                <th className="px-5 py-4 md:px-7">Offer</th>
                <th className="hidden px-5 py-4 md:table-cell md:px-7">Who</th>
                <th className="px-5 py-4 md:px-7">You pay</th>
                <th className="hidden px-5 py-4 md:table-cell md:px-7">
                  Ready now
                </th>
                <th className="px-5 py-4 text-right md:px-7">Bonus in 3 h</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {OFFERS.map(({ name, who, pay, now, bonus, pct }) => (
                <tr key={name} className="align-top">
                  <th scope="row" className="px-5 py-4 font-semibold md:px-7">
                    {name}
                    {/* On a phone Who sits under the name (MESITA-4992). */}
                    <span className="text-muted-foreground mt-1 block text-sm font-normal md:hidden">
                      {who}
                    </span>
                  </th>
                  <td className="text-muted-foreground hidden px-5 py-4 md:table-cell md:px-7">
                    {who}
                  </td>
                  <td className="px-5 py-4 tabular-nums md:px-7">{pay}</td>
                  <td className="hidden px-5 py-4 tabular-nums md:table-cell md:px-7">
                    {now}
                  </td>
                  <td className="text-primary px-5 py-4 text-right font-semibold whitespace-nowrap tabular-nums md:px-7">
                    {bonus}
                    <span className="text-muted-foreground block text-xs font-medium">
                      {pct}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <ul className="grid grid-cols-1 gap-8 md:grid-cols-3 md:gap-10">
          {RULES.map(({ title, body }) => (
            <li
              key={title}
              className="border-primary/40 flex flex-col gap-2 border-t-2 pt-5"
            >
              <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
              <p className="text-muted-foreground text-[15px] leading-relaxed">
                {body}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export { Offers };
