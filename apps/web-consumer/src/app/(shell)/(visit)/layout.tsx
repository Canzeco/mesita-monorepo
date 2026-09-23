import type { ReactNode } from "react";

// Route group retained to keep URLs stable. MESITA-2055 promotes Home,
// Search and Visit to separate bottom tabs, so this shared frame draws no rail.
//
// A ROUTE GROUP, so no URL moved: the pills live at /discover/scroll,
// /search, /discover/chat, /discover/favs and /new-visit, and `(visit)` adds
// nothing to any of them. The group exists only so ONE layout can draw the
// rail above three namespaces that share no path segment.
//
// Search is its own bottom tab again (MESITA-2055). MESITA-1616 had pulled it
// out from under discover/layout.tsx because Home's rail painted over the map;
// that bug cannot return now that Search is not under this group.
//
// Home's deck fetch stays one level down, in discover/layout.tsx — only Home,
// Chat and Favs read it, and Search and Pay must not wait on it.
//
// THE CHILDREN SLOT IS A FLEX COLUMN, not a block. The map, the Scroll deck
// and the place list all ask for `min-h-0 flex-1`, and a block parent makes
// that inert — the scroller sizes to content and clips under the tab bar.
export default function VisitLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {children}
      </div>
    </div>
  );
}
