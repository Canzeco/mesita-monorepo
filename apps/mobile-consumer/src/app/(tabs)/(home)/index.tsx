import { useCallback, useState } from "react";
import { useRouter } from "expo-router";

import { HomeScreen } from "@/features/discovery/screens/home-screen";
import { FeedScreen } from "@/features/social/screens/feed-screen";

export { RouteError as ErrorBoundary } from "@/features/auth";

export default function Route() {
  const router = useRouter();
  const welcome = useCallback(() => router.push("/welcome"), [router]);
  const [social, setSocial] = useState(false);
  if (social) {
    return (
      <FeedScreen
        onPlaces={() => setSocial(false)}
        onOpen={(item) =>
          router.push({
            pathname: "/social/person",
            params: { placeId: item.placeId, kind: item.kind, at: item.at },
          })
        }
      />
    );
  }
  return (
    <HomeScreen
      onOpenPlace={(placeId) => router.push({ pathname: "/place/[id]", params: { id: placeId } })}
      onChooseLocation={() => router.push("/location")}
      onMenu={() => router.push("/categories")}
      onWelcome={welcome}
      onSocial={() => setSocial(true)}
    />
  );
}
