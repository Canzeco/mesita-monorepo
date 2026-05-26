"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

// Sticky horizontal tab bar that sits below the venue's top-bar chrome
// (back/share + title). Each tab anchors to a section by id. Two-way
// binding:
//
//   • Click a tab → smooth-scrolls the page to that section. CSS
//     scroll-margin-top on the target (set via the SectionNavTarget
//     wrapper) accounts for the sticky bar + nav so the section header
//     lands flush below the chrome instead of hidden behind it.
//   • Scroll the page → an IntersectionObserver watches every section
//     and flags whichever has the most overlap with the viewport just
//     below the chrome. The active tab gets a pink underline + bold
//     label, and the tab strip auto-scrolls so the active tab stays
//     visible.
//
// Sections are passed as an ordered list of { id, label } so the page
// owns the source of truth. Tabs that don't match any section render
// inert; sections without a tab are simply not tracked.

type Section = { id: string; label: string };

export function VenueSectionNav({ sections }: { sections: Section[] }) {
  const [activeId, setActiveId] = useState<string>(sections[0]?.id ?? "");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const tabRefs = useRef<Record<string, HTMLAnchorElement | null>>({});

  // Track which section dominates the viewport so the active tab can
  // shift as the user scrolls. The 0.0 / 0.5 / 1.0 thresholds give us
  // a stable signal — the section currently crossing the upper third
  // wins. rootMargin "negative top" pulls the observation window down
  // so sections feel "active" once their content (not just their top
  // edge) sits in the readable area.
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) {
          setActiveId(visible[0].target.id);
        }
      },
      {
        rootMargin: "-30% 0px -50% 0px",
        threshold: [0, 0.25, 0.5, 0.75, 1],
      },
    );
    sections.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [sections]);

  // Slide the active tab into view inside the horizontal scroll. Uses
  // scrollIntoView with inline:"center" so the tab lands near the
  // middle of the strip — feels less twitchy than left-snapping.
  useEffect(() => {
    const tab = tabRefs.current[activeId];
    if (!tab) return;
    tab.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [activeId]);

  const onTabClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    const target = document.getElementById(id);
    if (!target) return;
    setActiveId(id);
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <nav
      ref={containerRef}
      className="bg-background/85 border-border sticky top-[60px] z-10 -mx-4 border-b backdrop-blur"
      aria-label="Venue sections"
    >
      <div className="scrollbar-hide flex gap-1 overflow-x-auto px-4 py-2">
        {sections.map((s) => {
          const active = s.id === activeId;
          return (
            <a
              key={s.id}
              ref={(el) => {
                tabRefs.current[s.id] = el;
              }}
              href={`#${s.id}`}
              onClick={(e) => onTabClick(e, s.id)}
              className={cn(
                "shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold tracking-wide transition",
                active
                  ? "bg-pink-gradient text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {s.label}
            </a>
          );
        })}
      </div>
    </nav>
  );
}

// Tiny wrapper that gives a section the id the nav targets and
// reserves scroll-margin-top so the smooth-scroll lands below the
// sticky chrome instead of underneath it.
export function SectionAnchor({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  return (
    <div id={id} className="scroll-mt-32">
      {children}
    </div>
  );
}
