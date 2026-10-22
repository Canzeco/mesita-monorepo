import { DestGrid, DestTileSkeleton } from "../profile-sections";
import { IdentityBarSkeleton } from "../me-skeletons";

// /me's fallback: the hub itself, as ProfileClient draws it (Pato,
// MESITA-2701: "the placeholders must be similar to the page you are
// loading, like the sizes"). Before it, the (shell) spinner sat centred on
// grey where the app bar and the grid were about to land.
//
//   the app bar          IdentityBar's band and its skeleton card, the same
//                        one the page draws while its profile read is out
//   2 · 2 · 2 · 2 · 1    the nine tiles in five DestGrids, Settings alone
//
// The scroller and its gaps are ProfileClient's own: px-4 on the tiles'
// 16px edge, pt-3 under the bar, 12px between rows.
//
// It sits in (hub) with the page so it wraps the hub only, never a /me/<box>
// (see page.tsx). The /me/[tab] catch-all re-exports it: it redirects here.
export default function MeLoading() {
  return (
    <div className="flex h-full flex-col">
      <IdentityBarSkeleton />
      <div className="scrollbar-hide flex-1 overflow-y-auto px-4 pt-3 pb-8">
        <div className="flex flex-col gap-3">
          {[2, 2, 2, 2, 1].map((cells, row) => (
            <DestGrid key={row}>
              {Array.from({ length: cells }, (_, i) => (
                <DestTileSkeleton key={i} />
              ))}
            </DestGrid>
          ))}
        </div>
      </div>
      <p role="status" className="sr-only">
        Loading Me
      </p>
    </div>
  );
}
