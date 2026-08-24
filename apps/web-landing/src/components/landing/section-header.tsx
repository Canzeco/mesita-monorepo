function SectionHeader({
  eyebrow,
  title,
  aside,
}: {
  eyebrow: string;
  title: string;
  aside: string;
}) {
  return (
    <header className="flex flex-col items-start gap-3 md:flex-row md:items-end md:justify-between">
      <div>
        <p className="text-primary text-xs font-semibold tracking-[0.18em] uppercase">
          {eyebrow}
        </p>
        <h2 className="font-display mt-2 max-w-2xl text-3xl font-semibold tracking-tight md:text-4xl">
          {title}
        </h2>
      </div>
      <p className="text-muted-foreground max-w-sm text-sm">{aside}</p>
    </header>
  );
}

export { SectionHeader };
