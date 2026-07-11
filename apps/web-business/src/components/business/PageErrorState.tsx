import Link from "next/link";
import { cn } from "@/lib/utils";
import { CTA_BUTTON_CLASS } from "@/lib/ui-classes";

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
            className={cn(CTA_BUTTON_CLASS, "mt-5")}
          >
            Try again
          </Link>
        </div>
      </div>
    </div>
  );
}
