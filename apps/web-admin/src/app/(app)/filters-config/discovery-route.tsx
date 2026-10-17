"use client";

// Discovery keeps four URLs. The panels are already mounted, so a tab click
// only changes which one is shown. Next's router is not asked to render again.

import { useEffect, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { DISCOVERY_TABS } from "./nav";

let override: string | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function selectDiscoveryHref(href: string) {
  const url = new URL(href, window.location.origin);
  override = url.pathname;
  const next = `${url.pathname}${url.search}${url.hash}`;
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (current !== next) window.history.pushState(null, "", next);
  emit();
}

export function useDiscoveryPathname(): string {
  const pathname = usePathname();
  const picked = useSyncExternalStore(subscribe, () => override, () => null);
  return picked ?? pathname;
}

function isDiscoveryTab(pathname: string): boolean {
  return DISCOVERY_TABS.some((tab) => tab.href === pathname);
}

export function useDiscoveryRoute(): string {
  const pathname = useDiscoveryPathname();

  useEffect(() => {
    const onPop = () => {
      override = window.location.pathname;
      emit();
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      override = null;
      emit();
    };
  }, []);

  useEffect(() => {
    const id = window.location.hash.replace(/^#/, "");
    if (!id) return;
    document.getElementById(id)?.scrollIntoView();
  }, [pathname]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest("a");
      if (!anchor) return;
      const raw = anchor.getAttribute("href");
      if (!raw || raw.startsWith("#")) return;
      let url: URL;
      try {
        url = new URL(raw, window.location.origin);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin || !isDiscoveryTab(url.pathname)) return;
      event.preventDefault();
      event.stopPropagation();
      selectDiscoveryHref(`${url.pathname}${url.search}${url.hash}`);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return pathname;
}
