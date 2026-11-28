// 🦚 Main § 7, Voucher Offers (MESITA-5126): what the app sells. Four
// vouchers, each bonus the place's pick (money.ts VOUCHER_BONUS_STEPS_BPS);
// then the one credit-back rate on every bill (MESITA-5124). Every reward is
// credit: there are no discounts and no VIP lines. Guest words: credit and
// bonus.
const VOUCHERS = [
  {
    name: "Welcome",
    note: "One per guest per place",
    pay: "MX$100",
    bonus: "+30% or +60%",
  },
  { name: "Small", pay: "MX$200", bonus: "+10% or +20%" },
  { name: "Medium", pay: "MX$1,000", bonus: "+20% or +40%" },
  { name: "Big", pay: "MX$5,000", bonus: "+30% or +60%" },
];

const BACK = [
  { name: "Every bill", who: "The first like every later one", back: "5%" },
  {
    name: "Where Small is +20%",
    who: "A place whose Small voucher bonus is +20% can give more",
    back: "10%",
  },
];

const RULES = [
  {
    title: "Everything lands in 3 hours.",
    body: "What the guest pays and the bonus land together 3 hours after the voucher sells, nothing before. A meal is shorter than that, so a voucher always pays for a return visit.",
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

const TH = "px-5 py-4 md:px-7";

function Offers() {
  return (
    <section id="offers" className="border-border scroll-mt-16 border-b">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-5 py-20 md:py-24">
        <div className="flex max-w-3xl flex-col gap-4">
          <p className="text-secondary text-xs font-semibold tracking-[0.18em] uppercase">
            Voucher Offers
          </p>
          <h2 className="font-display text-3xl font-semibold tracking-tight md:text-5xl">
            Pay MX$1,000. Get up to MX$1,400.
          </h2>
          <p className="text-muted-foreground text-base leading-relaxed md:text-lg">
            Four vouchers, each with a bonus the place picks. What you pay and
            the bonus land together, 3 hours later.
          </p>
        </div>

        <div className="border-border bg-card shadow-elev overflow-hidden rounded-3xl border">
          <table className="w-full text-left text-[15px]">
            <thead>
              <tr className="text-muted-foreground border-border border-b text-xs font-semibold tracking-wide uppercase">
                <th className={TH}>Voucher</th>
                <th className={TH}>You pay</th>
                <th className={`${TH} text-right`}>Bonus</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {VOUCHERS.map(({ name, note, pay, bonus }) => (
                <tr key={name} className="align-top">
                  <th scope="row" className={`${TH} font-semibold`}>
                    {name}
                    {note && (
                      <span className="text-muted-foreground mt-1 block text-sm font-normal">
                        {note}
                      </span>
                    )}
                  </th>
                  <td className={`${TH} tabular-nums`}>{pay}</td>
                  <td
                    className={`${TH} text-primary text-right font-semibold whitespace-nowrap tabular-nums`}
                  >
                    {bonus}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-4">
          <h3 className="text-xl font-semibold tracking-tight">
            Credit back on every bill
          </h3>
          <p className="text-muted-foreground max-w-3xl text-[15px] leading-relaxed">
            Paying a bill also earns credit back, on the part not paid with
            credit. Each place decides whether to give it. It is paid in credit
            at that place, never as a discount off the bill.
          </p>
          <div className="border-border bg-card shadow-elev overflow-hidden rounded-3xl border">
            <table className="w-full text-left text-[15px]">
              <thead>
                <tr className="text-muted-foreground border-border border-b text-xs font-semibold tracking-wide uppercase">
                  <th className={TH}>Bill</th>
                  <th className={`${TH} hidden md:table-cell`}>When</th>
                  <th className={`${TH} text-right`}>Credit back</th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {BACK.map(({ name, who, back }) => (
                  <tr key={name} className="align-top">
                    <th scope="row" className={`${TH} font-semibold`}>
                      {name}
                      {/* On a phone When sits under the name (MESITA-4992). */}
                      <span className="text-muted-foreground mt-1 block text-sm font-normal md:hidden">
                        {who}
                      </span>
                    </th>
                    <td
                      className={`${TH} text-muted-foreground hidden md:table-cell`}
                    >
                      {who}
                    </td>
                    <td
                      className={`${TH} text-primary text-right font-semibold whitespace-nowrap tabular-nums`}
                    >
                      {back}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
