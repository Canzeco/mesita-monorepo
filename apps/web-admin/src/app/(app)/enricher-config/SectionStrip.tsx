"use client";

import { useEffect, useState } from "react";

// Wayfinding for a page that is five sections and twelve function blocks deep.
// The strip does not exist until the first section scrolls away, so the top of
// the page stays as calm as the rest of the console — it is a way back, not
// chrome. Krug's trunk test: at depth you should still know where you are.
const LINKS: { id: string; label: string }[] = [
  { id: "s-sourcing", label: "1 Sourcing" },
  { id: "s-create", label: "2 Create" },
  { id: "s-enrich", label: "3 Enrich" },
  { id: "f-seed", label: "Seed" },
  { id: "f-pulse", label: "1 Pulse" },
  { id: "f-details", label: "2 Details" },
  { id: "f-serp", label: "3 Serp" },
  { id: "f-links", label: "4 Links" },
  { id: "f-social", label: "5 Social" },
  { id: "f-images", label: "6 Images" },
  { id: "f-menu", label: "7 Menu" },
  { id: "f-reviews", label: "8 Reviews" },
  { id: "f-description", label: "9 Description" },
  { id: "f-summary", label: "◇ Summary" },
  { id: "f-name", label: "◇ Name" },
  { id: "s-models", label: "5 Models" },
];

export function SectionStrip() {
  const [shown, setShown] = useState(false);
  const [here, setHere] = useState<string | null>(null);

  useEffect(() => {
    const first = document.getElementById("s-sourcing");
    if (!first) return;
    const gate = new IntersectionObserver(
      ([e]) => setShown(!e.isIntersecting),
      { threshold: 0 },
    );
    gate.observe(first);

    // Whichever section owns the middle of the viewport is where you are.
    const spy = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setHere(e.target.id);
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    for (const l of LINKS) {
      const el = document.getElementById(l.id);
      if (el) spy.observe(el);
    }
    return () => {
      gate.disconnect();
      spy.disconnect();
    };
  }, []);

  return (
    <nav
      aria-label="Sections"
      className={
        "border-border bg-card/90 fixed inset-x-0 top-0 z-20 border-b backdrop-blur transition-transform " +
        (shown ? "translate-y-0" : "-translate-y-full")
      }
    >
      <div className="mx-auto flex max-w-5xl items-center gap-1.5 overflow-x-auto px-4 py-2 sm:px-6">
        <span className="text-muted-foreground type-meta mr-1.5 font-bold tracking-wider whitespace-nowrap uppercase">
          Intake
        </span>
        {LINKS.map((l) => (
          <a
            key={l.id}
            href={`#${l.id}`}
            aria-current={here === l.id ? "true" : undefined}
            className={
              "rounded-lg px-2 py-1 text-xs whitespace-nowrap transition " +
              (here === l.id
                ? "bg-foreground text-card font-semibold"
                : "text-muted-foreground hover:bg-muted hover:text-foreground")
            }
          >
            {l.label}
          </a>
        ))}
      </div>
    </nav>
  );
}
