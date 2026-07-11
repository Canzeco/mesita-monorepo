import Link from "next/link";

export function PageErrorState({
  heading,
  message,
  retryHref,
}: {
  title?: string;
  subtitle?: string;
  heading: string;
  message: string;
  retryHref: string;
}) {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl px-4 py-10 md:px-6">
        <div className="border-destructive/40 bg-destructive/5 rounded-2xl border p-10 text-center">
          <h2 className="font-display text-destructive text-xl font-semibold tracking-tight">
            {heading}
          </h2>
          <p className="text-muted-foreground mx-auto mt-2 max-w-md text-sm">
            {message}
          </p>
          <Link
            href={retryHref}
            className="bg-foreground text-background mt-5 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition hover:opacity-90"
          >
            Try again
          </Link>
        </div>
      </div>
    </div>
  );
}
