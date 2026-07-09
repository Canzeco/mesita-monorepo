import type { ReactNode } from "react";

// Full-surface "Coming soon" panel for tab surfaces that are parked behind a
// Soon gate (Rewards, Reservations). Same premium framing as the standalone
// /reservations panel: gradient icon tile, eyebrow, title, one-liner.
export function ComingSoonSurface({
  icon,
  title,
  body,
}: {
  icon: ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="scrollbar-hide h-full overflow-y-auto">
      <div className="flex min-h-full flex-col items-center justify-center gap-4 px-6 py-16 text-center">
        <span className="bg-pink-gradient shadow-glow flex h-16 w-16 items-center justify-center rounded-2xl text-white">
          {icon}
        </span>
        <div className="flex flex-col items-center gap-1.5">
          <span className="text-primary text-[11px] font-semibold tracking-[0.18em] uppercase">
            Coming soon
          </span>
          <h2 className="font-display text-xl font-semibold tracking-tight">
            {title}
          </h2>
          <p className="text-muted-foreground max-w-xs text-sm leading-snug">
            {body}
          </p>
        </div>
      </div>
    </div>
  );
}
