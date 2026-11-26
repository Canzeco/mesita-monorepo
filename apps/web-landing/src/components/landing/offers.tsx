// Paying ahead, with real numbers (🦚 Main § 7, MESITA-4991). It is where
// Mesita earns and the hardest idea on the page, so it gets one worked
// example and the price list as a table. Guest words: bonus and credit,
// never voucher. Not live with real money yet, so the section says Soon.
const STEPS = [
  {
    title: "You pay MX$1,000.",
    body: "From the place’s profile, by card, Apple Pay or Google Pay.",
  },
  {
    title: "MX$1,000 is ready now.",
    body: "Spend it on tonight’s bill at that place.",
  },
  {
    title: "MX$200 more in 3 hours.",
    body: "The bonus lands after the meal, so it pays for your next visit.",
  },
];

const OFFERS = [
  { name: "Small", pay: "MX$200", get: "MX$220", bonus: "+10%" },
  { name: "Medium", pay: "MX$1,000", get: "MX$1,200", bonus: "+20%" },
  { name: "Big", pay: "MX$5,000", get: "MX$6,500", bonus: "+30%" },
  { name: "Welcome", pay: "MX$100", get: "MX$200", bonus: "+100%" },
];

function Offers() {
  return (
    <section id="offers" className="border-border scroll-mt-16 border-b">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-5 py-20 md:py-24">
        <div className="flex max-w-3xl flex-col gap-4">
          <p className="text-secondary text-xs font-semibold tracking-[0.18em] uppercase">
            Paying ahead · Soon
          </p>
          <h2 className="font-display text-3xl font-semibold tracking-tight md:text-5xl">
            Pay MX$1,000. Get MX$1,200.
          </h2>
          <p className="text-muted-foreground text-base leading-relaxed md:text-lg">
            The guest pays a place ahead and gets more to spend there. The place
            has the money before the meal.
          </p>
        </div>

        <ol className="grid grid-cols-1 gap-8 md:grid-cols-3 md:gap-10">
          {STEPS.map(({ title, body }, i) => (
            <li
              key={title}
              className="border-primary/40 flex flex-col gap-2 border-t-2 pt-5"
            >
              <span className="text-secondary font-display text-sm font-semibold">
                0{i + 1}
              </span>
              <h3 className="text-xl font-semibold tracking-tight">{title}</h3>
              <p className="text-muted-foreground text-[15px] leading-relaxed">
                {body}
              </p>
            </li>
          ))}
        </ol>

        <div className="border-border bg-card shadow-elev overflow-x-auto rounded-3xl border">
          <table className="w-full text-left text-[15px]">
            <thead>
              <tr className="text-muted-foreground border-border border-b text-xs font-semibold tracking-wide uppercase">
                <th className="px-5 py-4 md:px-7">Offer</th>
                <th className="px-5 py-4 md:px-7">You pay</th>
                <th className="px-5 py-4 md:px-7">You get</th>
                <th className="px-5 py-4 text-right md:px-7">Bonus</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {OFFERS.map(({ name, pay, get, bonus }) => (
                <tr key={name}>
                  <th scope="row" className="px-5 py-4 font-semibold md:px-7">
                    {name}
                  </th>
                  <td className="px-5 py-4 tabular-nums md:px-7">{pay}</td>
                  <td className="px-5 py-4 tabular-nums md:px-7">{get}</td>
                  <td className="text-primary px-5 py-4 text-right font-semibold tabular-nums md:px-7">
                    {bonus}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-muted-foreground max-w-3xl text-[15px] leading-relaxed">
          Welcome is once per guest at each place, for a guest who is new there.
          Credit spends only at the place that issued it, never expires, and can
          be sent to a friend. Each place chooses which offers it sells.
        </p>
      </div>
    </section>
  );
}

export { Offers };
