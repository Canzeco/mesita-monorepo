import { Megaphone } from "lucide-react";

// Buzz — navigable placeholder body; swap for the real section once Buzz
// grows its first content.
export function BuzzSection() {
  return (
    <section className="border-border bg-card flex flex-col items-center gap-4 rounded-2xl border p-10 text-center shadow-sm">
      <span className="bg-muted flex h-12 w-12 items-center justify-center rounded-full">
        <Megaphone className="text-muted-foreground h-6 w-6" />
      </span>
      <div>
        <h2 className="font-display text-lg font-semibold tracking-tight">
          Nothing here yet
        </h2>
        <p className="text-muted-foreground mx-auto mt-2 max-w-md text-sm leading-relaxed">
          Buzz for this place will appear here once the feature ships its
          first pieces.
        </p>
      </div>
    </section>
  );
}
