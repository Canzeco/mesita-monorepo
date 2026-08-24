"use client";

import { useEffect, useState } from "react";

// Wayfinding for five modules. The strip does not exist until the first
// module scrolls away — it is a way back, not chrome. Function hashes still
// work from Create/Enrich step chips; they are not repeated here.
const LINKS: { id: string; label: string }[] = [
  { id: "s-models", label: "Models" },
  { id: "s-sourcing", label: "Sourcing" },
  { id: "s-create", label: "Create" },
  { id: "s-enrich", label: "Enrich" },
  { id: "s-functions", label: "Functions" },
];

export function SectionStrip() {
  const [shown, setShown] = useState(false);
  const [here, setHere] = useState<string | null>(null);

  useEffect(() => {
    const first = document.getElementById("s-models");
    if (!first) return;
    const gate = new IntersectionObserver(
      ([e]) => setShown(!e.isIntersecting),
      { threshold: 0 },
    );
    gate.observe(first);

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
