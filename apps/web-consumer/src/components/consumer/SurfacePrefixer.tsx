"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { prefixPath, type Surface } from "@/lib/surface";

function currentSurface(): Surface {
  return document.documentElement.dataset.surface === "mob" ? "mob" : "web";
}

/** Keep <a> clicks and history updates on /mob or /web. */
export function SurfacePrefixer() {
  const router = useRouter();

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      const anchor = (event.target as Element | null)?.closest?.("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || !href.startsWith("/") || href.startsWith("//")) return;
      if (href.startsWith("/_next") || href.startsWith("/api")) return;
      const next = prefixPath(currentSurface(), href);
      if (next === href) return;
      event.preventDefault();
      event.stopPropagation();
      router.push(next);
    }

    const push = history.pushState.bind(history);
    const replace = history.replaceState.bind(history);
    function prefixed(url: unknown): unknown {
      if (typeof url !== "string" || !url.startsWith("/")) return url;
      const hashAt = url.indexOf("#");
      const beforeHash = hashAt === -1 ? url : url.slice(0, hashAt);
      const hash = hashAt === -1 ? "" : url.slice(hashAt);
      const queryAt = beforeHash.indexOf("?");
      const path = queryAt === -1 ? beforeHash : beforeHash.slice(0, queryAt);
      const query = queryAt === -1 ? "" : beforeHash.slice(queryAt);
      const next = prefixPath(currentSurface(), path);
      return next === path ? url : `${next}${query}${hash}`;
    }
    history.pushState = (data, unused, url) => push(data, unused, prefixed(url) as string);
    history.replaceState = (data, unused, url) =>
      replace(data, unused, prefixed(url) as string);

    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      history.pushState = push;
      history.replaceState = replace;
    };
  }, [router]);

  return null;
}
