import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SubTabs } from "./controls";

/** Every page opens the same way: title, status, main action, then its sub-pages. */
export function PageHeader({
  title,
  sub,
  status,
  actions,
  tabs,
  back,
}: {
  title: string;
  sub?: React.ReactNode;
  status?: React.ReactNode;
  actions?: React.ReactNode;
  tabs?: { href: string; label: string; count?: number }[];
  back?: { href: string; label: string };
}) {
  return (
    <>
      {back ? (
        <Link
          href={back.href}
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {back.label}
        </Link>
      ) : null}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-3xl font-semibold lg:text-4xl">{title}</h1>
            {status}
          </div>
          {sub ? <div className="mt-1 text-sm text-muted-foreground">{sub}</div> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      {tabs ? <SubTabs tabs={tabs} /> : null}
    </>
  );
}

export function PageBody({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-4xl px-4 pt-5 pb-28 lg:px-10 lg:pt-10 lg:pb-16">{children}</div>;
}
