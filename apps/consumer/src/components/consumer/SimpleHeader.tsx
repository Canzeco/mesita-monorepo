import Link from "next/link";

export function SimpleHeader({
  title,
  eyebrow,
}: {
  title: string;
  eyebrow?: string;
}) {
  return (
    <header className="border-border flex items-center gap-3 border-b px-4 py-3">
      <Link
        href="/profile"
        className="bg-peacock shadow-glow flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-lg"
        aria-label="Profile"
      >
        🦚
      </Link>
      <div className="min-w-0 flex-1">
        <h1 className="font-display text-xl leading-tight font-semibold tracking-tight">
          {title}
        </h1>
        {eyebrow && (
          <p className="text-muted-foreground mt-0.5 text-[10px] font-medium tracking-[0.18em] uppercase">
            {eyebrow}
          </p>
        )}
      </div>
    </header>
  );
}
