import * as WebBrowser from "expo-web-browser";
import { useEffect } from "react";

import { EmptyState } from "@/components/empty-state";

/** A page of mesita.ai, and only of mesita.ai. */
export function pageUrl(page: string): string {
  const url = new URL(`https://mesita.ai${page.startsWith("/") ? page : `/${page}`}`);
  return url.origin === "https://mesita.ai" ? url.href : "https://mesita.ai";
}

/** A mesita.ai page this build has no screen for. */
export function OpenScreen({ page, onClose }: { page: string; onClose: () => void }) {
  useEffect(() => {
    let live = true;
    WebBrowser.openBrowserAsync(pageUrl(page)).then(
      // Android answers "opened" at once; iPhone answers when it is closed.
      (end) => {
        if (live && end.type !== "opened") onClose();
      },
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [page, onClose]);
  return (
    <EmptyState
      message="This page opens in the browser."
      action={{ label: "Open again", onPress: () => void WebBrowser.openBrowserAsync(pageUrl(page)) }}
    />
  );
}
