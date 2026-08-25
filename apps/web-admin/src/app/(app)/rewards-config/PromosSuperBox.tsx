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
    <section className="border-border bg-muted/30 rounded-3xl border p-4 sm:p-6">
      <header className="mb-4">
        <h2 className="font-display text-lg font-semibold tracking-tight">
          {title}
        </h2>
        {subtitle ? (
          <p className="text-muted-foreground mt-1 max-w-3xl text-sm leading-relaxed">
            {subtitle}
          </p>
        ) : null}
      </header>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}
