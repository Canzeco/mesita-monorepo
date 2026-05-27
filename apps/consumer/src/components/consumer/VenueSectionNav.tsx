"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

// Sticky horizontal tab bar that sits below the venue's top-bar chrome
// (back/share + title). Each tab anchors to a section by id. Two-way
// binding:
//
//   • Click a tab → smooth-scrolls the page to that section. CSS
//     scroll-margin-top on the target (set via the SectionAnchor
//     wrapper) accounts for the sticky bar + nav so the section header
//     lands flush below the chrome instead of hidden behind it.
//   • Scroll the page → an IntersectionObserver watches every section
//     and flags whichever has the most overlap with the viewport just
//     below the chrome. The active tab gets the pink pill, and the tab
//     strip auto-scrolls so the active tab stays visible.
//
// Sections are passed as an ordered list of { id, label } so the page
// owns the source of truth.
//
// We animate the section scroll by hand instead of using
// `scrollIntoView({ behavior: 'smooth' })` because Chrome silently
// no-ops smooth scrolling on this layout's nested overflow-y-auto
// container — verified live on consumer.mesita.ai. Setting `scrollTop`
// each frame via rAF works reliably. For the same reason we never call
// `scrollIntoView` on the active tab (it can cancel an in-flight smooth
// scroll on a parent container); instead we move scrollLeft on the
// strip directly so vertical scroll is untouched.

type Section = { id: string; label: string };

function findScrollContainer(el: HTMLElement | null): HTMLElement | null {
  let cur = el?.parentElement ?? null;
  while (cur) {
    const cs = getComputedStyle(cur);
    const oy = cs.overflowY;
    if (
      (oy === "auto" || oy === "scroll") &&
      cur.scrollHeight > cur.clientHeight
    ) {
      return cur;
    }
    cur = cur.parentElement;
  }
  return null;
}

function easeInOutCos(t: number) {
  return 0.5 - 0.5 * Math.cos(Math.PI * t);
}

function animateScroll(
  container: HTMLElement,
  axis: "top" | "left",
  target: number,
  duration: number,
  cancelRef: { current: number | null },
) {
  const prop = axis === "top" ? "scrollTop" : "scrollLeft";
  const start = container[prop];
  const distance = target - start;
  if (Math.abs(distance) < 1) return;
  if (cancelRef.current != null) cancelAnimationFrame(cancelRef.current);
  const startTime = performance.now();
  const step = () => {
    const t = Math.min(1, (performance.now() - startTime) / duration);
    container[prop] = start + distance * easeInOutCos(t);
    if (t < 1) {
      cancelRef.current = requestAnimationFrame(step);
    } else {
      cancelRef.current = null;
    }
  };
  cancelRef.current = requestAnimationFrame(step);
}

export function VenueSectionNav({ sections }: { sections: Section[] }) {
  const [activeId, setActiveId] = useState<string>(sections[0]?.id ?? "");
  const stripRef = useRef<HTMLDivElement | null>(null);
  const tabRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const vScrollRaf = useRef<number | null>(null);
  const hScrollRaf = useRef<number | null>(null);

  // Track which section dominates the viewport so the active tab can
  // shift as the user scrolls. The 0.0 / 0.25 / 0.5 / 0.75 / 1.0
  // thresholds give us a stable signal. rootMargin "negative top + tall
  // bottom" pulls the observation window down so sections feel "active"
  // once their content (not just their top edge) sits in the readable
  // area below the sticky chrome.
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

  // Center the active tab inside the horizontal strip. Touches only
  // scrollLeft on the strip itself so this can never interfere with a
  // smooth vertical scroll initiated by `onTabClick`.
  useEffect(() => {
    const tab = tabRefs.current[activeId];
    const strip = stripRef.current;
    if (!tab || !strip) return;
    const max = Math.max(0, strip.scrollWidth - strip.clientWidth);
    const center = tab.offsetLeft + tab.offsetWidth / 2 - strip.clientWidth / 2;
    const target = Math.max(0, Math.min(max, center));
    animateScroll(strip, "left", target, 250, hScrollRaf);
  }, [activeId]);

  // Cancel any in-flight rAF on unmount.
  useEffect(
    () => () => {
      if (vScrollRaf.current != null) cancelAnimationFrame(vScrollRaf.current);
      if (hScrollRaf.current != null) cancelAnimationFrame(hScrollRaf.current);
    },
    [],
  );

  const onTabClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    const target = document.getElementById(id);
    if (!target) return;
    setActiveId(id);
    const container = findScrollContainer(target);
    if (!container) return;
    const marginTop = parseFloat(getComputedStyle(target).scrollMarginTop) || 0;
    const containerRect = container.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const topInContainer =
      container.scrollTop + targetRect.top - containerRect.top - marginTop;
    const max = Math.max(0, container.scrollHeight - container.clientHeight);
    animateScroll(
      container,
      "top",
      Math.max(0, Math.min(max, topInContainer)),
      400,
      vScrollRaf,
    );
  };

  return (
    <nav
      // sticky top-0 anchors the strip to the very top of the modal's
      // scroll area — which sits flush below the modal header now that
      // the header lives outside the scroll container. The previous
      // `top-[60px]` left a 60px gap of empty modal background between
      // the header and the strip during scroll.
      className="bg-background/85 border-border sticky top-0 z-10 -mx-4 border-b backdrop-blur"
      aria-label="Venue sections"
    >
      <div
        ref={stripRef}
        className="scrollbar-hide flex gap-1 overflow-x-auto px-4 py-2"
      >
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
