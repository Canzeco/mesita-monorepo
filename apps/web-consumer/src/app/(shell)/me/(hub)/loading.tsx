import { DestTileSkeleton } from "../profile-sections";
import { MeHubFrame } from "../hub-tiles";
import { IdentityBarSkeleton } from "../me-skeletons";

// /me's fallback: the hub itself, as ProfileClient draws it (Pato,
// MESITA-2701: "the placeholders must be similar to the page you are
// loading, like the sizes"). Before it, the (shell) spinner sat centred on
// grey where the app bar and the grid were about to land.
//
//   the app bar          IdentityBar's band and its skeleton card, the same
//                        one the page draws while its profile read is out
//   3 · 3 · 3 · 3 · 1      the thirteen grid cells, Settings last (MESITA-3716)
//
// The cells, their shapes, the scroller and the words are hub-tiles.tsx's,
// the page's own source, so the page lands without a jump. Only the strings
// cross into the tile; the Icon is a function and cannot (MESITA-2129).
//
// It sits in (hub) with the page so it wraps the hub only, never a /me/<box>
// (see page.tsx). The /me/[tab] catch-all re-exports it: it redirects here.
export default function MeLoading() {
  return (
    <MeHubFrame
      bar={<IdentityBarSkeleton />}
      tile={(cell, shape) => (
        <DestTileSkeleton
          shape={shape}
          title={cell.title}
          summary={cell.summary}
        />
      )}
    >
      <p role="status" className="sr-only">
        Loading Me
      </p>
    </MeHubFrame>
  );
}
