import { useCallback, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";

import { HomeScreen } from "@/features/discovery/screens/home-screen";
import { FeedScreen } from "@/features/social/screens/feed-screen";

export { RouteError as ErrorBoundary } from "@/features/auth";

export default function Route() {
  const router = useRouter();
  const welcome = useCallback(() => router.push("/welcome"), [router]);
  // Menu wears its open state while the Categories window is up.
  const [menuOpen, setMenuOpen] = useState(false);
  useFocusEffect(useCallback(() => setMenuOpen(false), []));
  return (
    <HomeScreen
      onOpenPlace={(placeId) => router.push({ pathname: "/place/[id]", params: { id: placeId } })}
      onReserve={(placeId) => router.push({ pathname: "/reserve/[placeId]", params: { placeId } })}
      onChooseLocation={() => router.push("/location")}
      onMenu={() => {
        setMenuOpen(true);
        router.push("/categories");
      }}
      menuOpen={menuOpen}
      onWelcome={welcome}
      // Social is a chip: the feed under Home's own header and strip.
      social={
        <FeedScreen
          onOpen={(item) =>
            router.push({
              pathname: "/social/person",
              params: { placeId: item.placeId, kind: item.kind, at: item.at },
            })
          }
          onOpenPlace={(id) => router.push({ pathname: "/place/[id]", params: { id } })}
          onFix={() => router.push("/me/profile")}
        />
      }
    />
  );
}
