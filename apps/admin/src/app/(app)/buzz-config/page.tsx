import { Megaphone } from "lucide-react";

export const dynamic = "force-dynamic";

// Placeholder body — swap for a client component once Buzz grows its knobs.
export default function BuzzConfigPage() {
  return (
    <section className="border-border bg-card shadow-elev flex flex-col items-center gap-4 rounded-2xl border p-10 text-center">
      <span className="bg-muted flex h-12 w-12 items-center justify-center rounded-full">
        <Megaphone className="text-muted-foreground h-6 w-6" />
      </span>
      <div>
        <h2 className="font-display text-lg font-semibold tracking-tight">
          Nothing to configure yet
        </h2>
        <p className="text-muted-foreground mx-auto mt-2 max-w-md text-sm leading-relaxed">
          Buzz settings will appear here once the feature ships its first
          knobs.
        </p>
      </div>
    </section>
  );
}
