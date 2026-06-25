import { ManageMultipleTabs } from "./TabNav";

// "Manage Multiple Units" — the three bulk tools are addressable sub-routes
// (/manage-multiple/{search,create,update}). This layout owns the shared
// header + tab nav; each sub-route renders its tool body into {children}.
export default function ManageMultipleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-5xl px-8 pt-12 pb-24">
      <header>
        <p className="text-muted-foreground text-xs font-medium tracking-[0.14em] uppercase">
          Units · Multiple
        </p>
        <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
          Manage Multiple Units
        </h1>
      </header>

      <ManageMultipleTabs />

      <div className="mt-8">{children}</div>
    </div>
  );
}
