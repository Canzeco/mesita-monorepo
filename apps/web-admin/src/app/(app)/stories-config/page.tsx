import { ConfigPageLayout } from "@/components/admin-ui";
import { getStoriesConfig } from "./actions";
import { DEFAULT_STORIES } from "./catalog";
import { StoriesConfigClient } from "./StoriesConfigClient";
import { StoryDesk } from "./StoryDesk";

// Admin › Configurations › Stories (MESITA-4425): who can buy the Story
// voucher, and the real Story timings, read-only.
export const dynamic = "force-dynamic";

export default async function StoriesConfigPage() {
  const res = await getStoriesConfig();
  return (
    <ConfigPageLayout
      title="Stories"
      description="Rules for the Story voucher: post an Instagram story tagging the place, get a bonus."
    >
      <StoriesConfigClient
        initialConfig={res.ok ? res.config : DEFAULT_STORIES}
        initialPaymentsLive={res.ok ? res.paymentsLive : true}
        initialStoryMode={res.ok ? res.storyMode : null}
        loadError={res.ok ? null : res.error}
      />
      <StoryDesk />
    </ConfigPageLayout>
  );
}
