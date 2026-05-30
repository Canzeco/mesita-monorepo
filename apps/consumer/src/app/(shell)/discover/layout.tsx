// The top chrome row (rendered by TopBar via DiscoverHeader) hosts the
// Swipe/Map/AI Search tabs. Discovery filters open from a Filter button in the
// swipe action bar (see SwipeDeck → FilterSheet), so this layout is just the
// scroll container for the active discover surface.
export default function DiscoverLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="scrollbar-hide flex flex-1 flex-col overflow-y-auto">
      {children}
    </div>
  );
}
