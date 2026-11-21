import { ConfigPageLayout } from "@/components/admin-ui";
import { getStoriesConfig } from "@/app/(app)/stories-config/actions";
import { DEFAULT_STORIES } from "@/app/(app)/stories-config/catalog";
import { StoryDesk } from "./StoryDesk";
import { StoryTestClient } from "./StoryTestClient";

// Extra › Story (MESITA-4522). The emulator and the settle desk. The follower
// floor stays on Configurations › Stories.
export const dynamic = "force-dynamic";

export default async function StoryTestPage() {
  const res = await getStoriesConfig();
  return (
    <ConfigPageLayout
      title="Story"
      description="Turn the emulator on, then settle a Story from here. Follower rules stay on Configurations › Stories."
    >
      <div className="flex flex-col gap-4">
        <StoryTestClient
          initialConfig={res.ok ? res.config : DEFAULT_STORIES}
          initialPaymentsLive={res.ok ? res.paymentsLive : true}
          initialStoryMode={res.ok ? res.storyMode : null}
          loadError={res.ok ? null : res.error}
        />
        <StoryDesk />
      </div>
    </ConfigPageLayout>
  );
}
