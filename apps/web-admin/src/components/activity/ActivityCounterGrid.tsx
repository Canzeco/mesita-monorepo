const pct = (n: number) => `${Math.round(n * 100)}%`;

export function ActivityCounterGrid({
  windowDays,
  guestOpens,
  guestSocial,
  operatorVerbs,
}: {
  windowDays: number;
  guestOpens: {
    opens: number;
    places: number;
    profileRate: number;
    byOutcome: { created: number; existing: number; refused: number; failed: number };
  };
  guestSocial: { viewedMembers: number; savedMembers: number };
  operatorVerbs: Record<
    "create" | "update" | "enrich" | "edit",
    { succeeded: number; failed: number }
  >;
}) {
  const stats = [
    { label: "Opens", value: String(guestOpens.opens) },
    { label: "Views", value: String(guestSocial.viewedMembers) },
    { label: "Saves", value: String(guestSocial.savedMembers) },
    { label: "Create", value: String(operatorVerbs.create.succeeded) },
    { label: "Update", value: String(operatorVerbs.update.succeeded) },
    { label: "Enrich", value: String(operatorVerbs.enrich.succeeded) },
    { label: "Edit", value: String(operatorVerbs.edit.succeeded) },
    {
      label: "Profile rate",
      value: guestOpens.opens > 0 ? pct(guestOpens.profileRate) : "—",
    },
  ];
  return (
    <div>
      <p className="text-muted-foreground type-meta mb-3">Last {windowDays} days</p>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        {stats.map((stat) => (
          <div key={stat.label} className="border-border rounded-xl border p-3">
            <dt className="text-muted-foreground type-meta">{stat.label}</dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums">{stat.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
