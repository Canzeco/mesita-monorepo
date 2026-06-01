"use client";

import { Clock3 } from "lucide-react";

export default function DiscoverSearchPage() {
  return (
    <div className="flex h-full items-start justify-center px-4 pt-8">
      <section className="border-border bg-card w-full max-w-md rounded-2xl border p-6 text-center">
        <span className="bg-muted mx-auto mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full">
          <Clock3 className="text-muted-foreground h-5 w-5" />
        </span>
        <p className="text-foreground text-base font-semibold">Search is coming soon</p>
        <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
          We are rebuilding this screen. Use <span className="font-medium">Swipe</span>,{" "}
          <span className="font-medium">Map</span>, or <span className="font-medium">Add</span>{" "}
          for now.
        </p>
      </section>
    </div>
  );
}
