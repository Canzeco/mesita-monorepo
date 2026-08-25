export function PromosSuperBox({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-border bg-card shadow-card rounded-3xl border p-5 sm:p-8">
      <header className="border-border mb-5 border-b pb-4">
        <h2 className="font-display text-xl font-semibold tracking-tight">
          {title}
        </h2>
        {subtitle ? (
          <p className="text-muted-foreground mt-1.5 max-w-3xl text-sm leading-relaxed">
            {subtitle}
          </p>
        ) : null}
      </header>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}
