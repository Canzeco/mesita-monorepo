// 🦚 Main § 7, Voucher Offers (MESITA-5002): what the app sells. Three
// vouchers, each bonus the place's pick (money.ts VOUCHER_BONUS_STEPS_BPS);
// then the visit discounts each place sets (cashback.ts *_STEPS_BPS). Guests
// see discounts only (#4928). Guest words: credit and bonus.
const VOUCHERS = [
  { name: "Small", pay: "MX$200", bonus: "+10% or +20%" },
  { name: "Medium", pay: "MX$1,000", bonus: "+20% or +40%" },
  { name: "Big", pay: "MX$5,000", bonus: "+30% or +60%" },
];

const VISITS = [
  { name: "Welcome", who: "Your first bill at the place", off: "10% or 20%" },
  { name: "Returning", who: "Every bill after that", off: "5% or 10%" },
  { name: "VIP Welcome", who: "A VIP’s first bill", off: "10% or 20%" },
  { name: "VIP Returning", who: "A VIP’s bills after that", off: "10% or 20%" },
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
            Three vouchers, each with a bonus the place picks. What you pay is
            ready now; the bonus lands in 3 hours.
          </p>
        </div>

        <div className="border-border bg-card shadow-elev overflow-hidden rounded-3xl border">
          <table className="w-full text-left text-[15px]">
            <thead>
              <tr className="text-muted-foreground border-border border-b text-xs font-semibold tracking-wide uppercase">
                <th className={TH}>Voucher</th>
                <th className={TH}>You pay</th>
                <th className={`${TH} text-right`}>Bonus in 3 h</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {VOUCHERS.map(({ name, pay, bonus }) => (
                <tr key={name}>
                  <th scope="row" className={`${TH} font-semibold`}>
                    {name}
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
            Discounts at the bill
          </h3>
          <p className="text-muted-foreground max-w-3xl text-[15px] leading-relaxed">
            Each place can also take a discount off the part of the bill not
            paid with credit. An invitation code makes a guest VIP.
          </p>
          <div className="border-border bg-card shadow-elev overflow-hidden rounded-3xl border">
            <table className="w-full text-left text-[15px]">
              <thead>
                <tr className="text-muted-foreground border-border border-b text-xs font-semibold tracking-wide uppercase">
                  <th className={TH}>Visit</th>
                  <th className={`${TH} hidden md:table-cell`}>When</th>
                  <th className={`${TH} text-right`}>Off the bill</th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {VISITS.map(({ name, who, off }) => (
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
                      {off}
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
