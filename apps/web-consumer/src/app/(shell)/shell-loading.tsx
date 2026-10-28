import { GeneratingPlaceScreen } from "@/components/consumer/GeneratingPlace";
import { HomeLoadingFrame } from "@/components/consumer/home/HomeLoadingFrame";
import { PlacePageSkeleton } from "@/components/consumer/overlay/DetailSkeletons";
import SearchChatLoading from "./(discovery)/search/chat/loading";
import SearchLoading from "./(discovery)/search/loading";
import MeLoading from "./me/(hub)/loading";
import PayLoading from "./pay/loading";
import ShareLoading from "./share/loading";

// THE PLACEHOLDER IS THE LOADING SCREEN, NEVER A SPINNER (Pato, MESITA-2840:
// "why spinning and then placeholder, don't do that. just use the
// placeholder directly"). A tap on the bar from Me, Pay or Share lands on
// the (shell) boundary, and a full page load on the root one, before the
// target's own loading.tsx can mount; both drew a centred spinner, so Home
// came in as spinner → tiles. Both now draw the target's own frame, picked
// by the bare path (the proxy's x-bare-pathname, which names the target on
// a navigation's request too). A place open that fell back to a full load
// (lib/navigate.ts) lands here too, so it draws the profile's silhouette,
// never a blank card with Home lit (Pato, MESITA-2973). Any other route gets
// the plain background: its own loading.tsx follows at once.
export function ShellLoadingFor({ bare }: { bare: string }) {
  const at = (root: string) => bare === root || bare.startsWith(`${root}/`);
  if (at("/place/open")) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <GeneratingPlaceScreen variant="page" />
      </div>
    );
  }
  if (at("/place")) return <PlacePageSkeleton />;
  if (at("/search/chat")) return <SearchChatLoading />;
  if (at("/search")) return <SearchLoading />;
  if (at("/home")) return <HomeLoadingFrame />;
  if (bare === "/me") return <MeLoading />;
  if (at("/pay")) return <PayLoading />;
  if (at("/share")) return <ShareLoading />;
  return <div className="bg-background min-h-0 flex-1" aria-busy />;
}
