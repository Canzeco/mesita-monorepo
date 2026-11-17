"use client";

import { useEffect } from "react";

// THE SCROLLBAR FLOATS, IT NEVER PUSHES (MESITA-4109, Pato: "the scrollbar
// should not push content to the left. it must be on top ... that should
// only happen in home places"). On a desktop browser a styled scrollbar takes
// 3px of the scroller's width, so the content moved left. globals.css hides
// the native bar on every `.scrollbar-thin-dark` scroller but Home's
// (`data-home-scroller`), and this draws the same 3px grey thumb over the
// content's right edge instead: one fixed layer, no clicks, nothing in the
// page's flow. A thumb whose scroller is covered (a sheet, a dialog, the
// next screen sliding over it) or does not overflow is hidden.
//
// No state and no re-renders: it only moves its own divs. It redraws on
// scroll, on resize, and for a short while after anything in the page
// changes (a screen sliding in moves its scroller without scrolling it).
//
// LEFT WHEN ASKED (Pato, MESITA-4271: "also add really thin scrollbar in the
// left side of latral men"): a scroller with `data-scrollbar-left` gets its
// thumb at its left edge instead (Home's family rail).

const SELECTOR = ".scrollbar-thin-dark:not([data-home-scroller])";
const INSET = 2;
const WIDTH = 3;
const MIN_THUMB = 24;

export function OverlayScrollbars() {
  useEffect(() => {
    const layer = document.createElement("div");
    layer.setAttribute("aria-hidden", "true");
    layer.dataset.overlayScrollbars = "";
    // Above the route and local overlays' surfaces; a covered thumb is
    // hidden by the hit test below, so the order only matters at the edge.
    layer.style.cssText =
      "position:fixed;inset:0;pointer-events:none;z-index:135;overflow:hidden";
    document.body.appendChild(layer);

    const thumbs = new Map<HTMLElement, HTMLDivElement>();
    let activeUntil = 0;
    let raf = 0;

    const kick = (ms = 700) => {
      activeUntil = Math.max(activeUntil, performance.now() + ms);
      if (!raf) raf = requestAnimationFrame(frame);
    };
    const onScroll = () => kick(150);
    const resize = new ResizeObserver(() => kick());

    function track() {
      for (const el of document.querySelectorAll<HTMLElement>(SELECTOR)) {
        if (thumbs.has(el)) continue;
        const thumb = document.createElement("div");
        thumb.style.cssText = `position:absolute;left:0;top:0;width:${WIDTH}px;border-radius:9999px;background:oklch(0.72 0 0);display:none;will-change:transform`;
        layer.appendChild(thumb);
        thumbs.set(el, thumb);
        el.addEventListener("scroll", onScroll, { passive: true });
        resize.observe(el);
      }
      for (const [el, thumb] of thumbs) {
        if (el.isConnected && el.matches(SELECTOR)) {
          // Content that grows (a list arriving, an image loading) changes
          // what there is to scroll without resizing the scroller.
          for (const child of el.children) resize.observe(child);
          continue;
        }
        el.removeEventListener("scroll", onScroll);
        resize.unobserve(el);
        thumb.remove();
        thumbs.delete(el);
      }
    }

    function draw() {
      for (const [el, thumb] of thumbs) {
        const r = el.getBoundingClientRect();
        const { scrollHeight, clientHeight, scrollTop } = el;
        const track = r.height - INSET * 2;
        if (
          r.width <= 0 ||
          track <= MIN_THUMB ||
          scrollHeight <= clientHeight + 1
        ) {
          thumb.style.display = "none";
          continue;
        }
        const h = Math.max(MIN_THUMB, (track * clientHeight) / scrollHeight);
        const progress = Math.min(
          1,
          Math.max(0, scrollTop / (scrollHeight - clientHeight)),
        );
        const left = el.hasAttribute("data-scrollbar-left");
        const x = left ? r.left + INSET : r.right - INSET - WIDTH;
        const y = r.top + INSET + (track - h) * progress;
        // Hidden when something else is on top of the scroller there.
        const hit = document.elementFromPoint(
          left ? x + WIDTH + 4 : x - 4,
          y + h / 2,
        );
        if (!hit || !el.contains(hit)) {
          thumb.style.display = "none";
          continue;
        }
        thumb.style.display = "block";
        thumb.style.height = `${h}px`;
        thumb.style.transform = `translate(${x}px, ${y}px)`;
      }
    }

    function frame() {
      raf = 0;
      draw();
      if (performance.now() < activeUntil) raf = requestAnimationFrame(frame);
    }

    const changes = new MutationObserver((records) => {
      // Our own thumbs moving is not a change in the page.
      if (records.every((m) => layer.contains(m.target))) return;
      track();
      kick();
    });
    changes.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["class", "data-state", "hidden"],
    });
    const onWindow = () => kick();
    window.addEventListener("resize", onWindow);

    track();
    kick(1500);

    return () => {
      cancelAnimationFrame(raf);
      changes.disconnect();
      resize.disconnect();
      window.removeEventListener("resize", onWindow);
      for (const el of thumbs.keys())
        el.removeEventListener("scroll", onScroll);
      layer.remove();
    };
  }, []);

  return null;
}
