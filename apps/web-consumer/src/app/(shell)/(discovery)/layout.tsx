import type { ReactNode } from "react";

// The discovery engines' group: Home's three modes and Search. Home and Search
// are separate bottom tabs (MESITA-2055), so this shared frame draws no rail.
//
// A ROUTE GROUP, so no URL moved: the pages live at /discover/places,
// /discover/social and /search, and the
// group adds nothing to any of them. It exists only so ONE layout can give
// two namespaces that share no path segment the same flex frame.
//
// Search's rail bug cannot return: MESITA-1616 pulled it out from under
// discover/layout.tsx because Home's rail painted over the map, and the rail
// is drawn one level down, in discover/layout.tsx, where only Home's four
// pills live. Home's deck fetch sits there too — Search must not wait on it.
//
// THE CHILDREN SLOT IS A FLEX COLUMN, not a block. The map, the Scroll deck
// and the catalog rails all ask for `min-h-0 flex-1`, and a block parent makes
// that inert — the scroller sizes to content and clips under the tab bar.
export default function DiscoverGroupLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {children}
      </div>
    </div>
  );
}
