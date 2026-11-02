// The advantage both sides stand on (🦚 Main § 2): Mesita never needs to
// onboard a place to serve it. Three steps, then the one line on what sits
// between the two sides.
const STEPS = [
  {
    title: "The catalog builds itself.",
    body: "The Enricher starts from Google and fills each profile from the place’s Instagram, website and reviews. Every place is covered the day a city turns on.",
  },
  {
    title: "The agent makes the call.",
    body: "Booking still happens by phone and WhatsApp. The Reservationist phones the place for you, so any place takes part just by answering.",
  },
  {
    title: "The place takes over when it wants.",
    body: "It finds its profile, claims it and turns products on by itself. Either side works when the other is absent.",
  },
];

function How() {
  return (
    <section id="how" className="bg-hero border-border scroll-mt-16 border-b">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-5 py-20 md:py-24">
        <div className="flex max-w-3xl flex-col gap-4">
          <p className="text-secondary text-xs font-semibold tracking-[0.18em] uppercase">
            How it works
          </p>
          <h2 className="font-display text-3xl font-semibold tracking-tight md:text-5xl">
            Mesita never needs a place to sign up to serve it.
          </h2>
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
        <p className="text-foreground max-w-3xl text-base leading-relaxed md:text-lg">
          Digital Payments, Credit Prepayments and Credit Rewards sit between
          the two sides: the money moment of a visit, and the reason a guest
          comes back.
        </p>
      </div>
    </section>
  );
}

export { How };
