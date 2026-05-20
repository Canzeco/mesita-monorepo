import { Bell, Sparkles } from "lucide-react";

export const dynamic = "force-dynamic";

// Placeholder. The eventual feed surfaces ops-relevant events — newly
// claimed venues, venues sitting in pending verification longer than
// expected, ownership disputes, AI walkthroughs that scored low
// enough to need a human eye. Wired up later once the underlying
// event table lands; the route + sidebar entry exist now so the
// surface is reachable and we can iterate on the design.

export default function NotificationsPage() {
  return (
    <div className="mx-auto max-w-3xl px-8 pt-12 pb-14">
      <p className="text-muted-foreground text-xs font-medium tracking-[0.14em] uppercase">
        Inbox · Notifications
      </p>
      <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
        Notifications
      </h1>
      <p className="text-muted-foreground mt-3 max-w-xl text-sm leading-relaxed">
        Operational events worth knowing about — new venues claimed,
        verification anomalies, places flagged for follow-up.
      </p>

      <section className="border-border bg-card mt-8 flex flex-col items-center gap-4 rounded-2xl border p-10 text-center">
        <span className="bg-muted text-muted-foreground flex h-12 w-12 items-center justify-center rounded-full">
          <Bell className="h-5 w-5" />
        </span>
        <h2 className="font-display text-lg font-semibold tracking-tight">
          Coming soon
        </h2>
        <p className="text-muted-foreground max-w-md text-sm leading-relaxed">
          We&apos;ll surface things like{" "}
          <span className="text-foreground font-medium">
            new place created
          </span>{" "}
          and{" "}
          <span className="text-foreground font-medium">
            new place claimed
          </span>{" "}
          here, with one-click actions to dig in. The event pipeline
          isn&apos;t wired yet — this page is a stub so the sidebar
          entry has somewhere to land.
        </p>
        <span className="bg-secondary/15 text-secondary inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase">
          <Sparkles className="h-3 w-3" />
          Soon
        </span>
      </section>
    </div>
  );
}
