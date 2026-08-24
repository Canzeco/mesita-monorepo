// Typographic set piece — deliberately image-free between two visual
// sections. This is the paragraph an evaluator quotes.
function Summary() {
  return (
    <section className="border-border bg-card border-y">
      <div className="mx-auto w-full max-w-4xl px-5 py-20 text-center md:py-28">
        <p className="text-primary text-xs font-semibold tracking-[0.18em] uppercase">
          What Mesita is
        </p>
        <p className="font-display mt-6 text-2xl leading-[1.4] tracking-tight md:text-3xl">
          Mesita is an AI-native platform for going out — restaurants, cafés and
          bars — that folds discovery, reservations, ordering, rewards and
          payments into one app, serving both sides of the table: the guest’s
          whole plan, and the place’s whole funnel.
        </p>
        <p className="font-display text-muted-foreground mt-7 text-xl leading-[1.45] tracking-tight md:text-2xl">
          Its structural advantage:{" "}
          <em className="text-secondary not-italic">
            Mesita never needs to onboard a restaurant to serve it.
          </em>{" "}
          The catalog builds itself from public data, AI enriches every profile,
          and the agents talk to places the way everyone already does — by
          phone.
        </p>
      </div>
    </section>
  );
}

export { Summary };
