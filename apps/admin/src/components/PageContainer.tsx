type PageSize = "3xl" | "5xl" | "6xl";

const MAX_WIDTH: Record<PageSize, string> = {
  "3xl": "max-w-3xl",
  "5xl": "max-w-5xl",
  "6xl": "max-w-6xl",
};

// Shared page wrapper — responsive horizontal padding and vertical rhythm
// for every authenticated admin surface.
export function PageContainer({
  children,
  size = "6xl",
  className = "",
}: {
  children: React.ReactNode;
  size?: PageSize;
  className?: string;
}) {
  return (
    <div
      className={
        "mx-auto w-full px-4 pt-8 pb-10 sm:px-6 sm:pt-12 sm:pb-14 lg:px-8 " +
        MAX_WIDTH[size] +
        (className ? ` ${className}` : "")
      }
    >
      {children}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
}) {
  return (
    <header>
      {eyebrow && (
        <p className="text-muted-foreground text-xs font-medium tracking-[0.14em] uppercase">
          {eyebrow}
        </p>
      )}
      <h1 className="font-display mt-2 text-2xl font-semibold tracking-tight sm:text-3xl md:text-4xl">
        {title}
      </h1>
      {description && (
        <p className="text-muted-foreground mt-3 max-w-3xl text-sm leading-relaxed">
          {description}
        </p>
      )}
    </header>
  );
}
