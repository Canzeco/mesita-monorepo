import type { ReactNode } from "react";

// The discovery group: Home (/home) and Search (/search). They are separate
// bottom tabs (MESITA-2055), so this shared frame draws no header.
//
// A ROUTE GROUP, so it adds nothing to either URL. It exists only so ONE
// layout can give two namespaces that share no path segment the same flex
// frame. Home's header is drawn one level down, in home/layout.tsx, so it
// never paints over Search's map (MESITA-1616).
//
// THE CHILDREN SLOT IS A FLEX COLUMN, not a block. The map and the catalog
// rails both ask for `min-h-0 flex-1`, and a block parent makes that inert —
// the scroller sizes to content and clips under the tab bar.
export default function DiscoveryGroupLayout({
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
