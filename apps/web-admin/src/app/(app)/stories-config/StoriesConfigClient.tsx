"use client";

// Admin › Configurations › Stories (MESITA-4425). The follower floor and the
// real bonus wait and time to post, read-only. The emulator and the settle
// desk live on Extra › Story (MESITA-4522).
//
// Saving a floor LOWER than the saved one and below 1,000 while payments are
// live asks first, inline above Save. The EF logs every save with the admin.

import { useState } from "react";
import { Camera } from "lucide-react";
import { Button, Chip, Notice, NumberField, ReadField, SectionCard } from "@/components/admin-ui";
import { SaveRow } from "@/components/admin-ui/config";
import { useConfigEditor } from "@/components/admin-ui/use-config-editor";
import { getStoriesConfig, updateStoriesConfig } from "./actions";
import { formatDuration, needsFloorConfirm, type StoriesConfig, STORY_MIN_FOLLOWERS_MAX } from "./catalog";

export function StoriesConfigClient({
  initialConfig,
  initialPaymentsLive,
  loadError,
}: {
  initialConfig: StoriesConfig;
  initialPaymentsLive: boolean;
  loadError: string | null;
}) {
  const [paymentsLive, setPaymentsLive] = useState(initialPaymentsLive);
  const [confirming, setConfirming] = useState(false);
  const { cfg, setCfg, saved, setOk, pending, error, loadBlocked, ok, saveWith } = useConfigEditor({
    initialConfig,
    loadError,
    load: getStoriesConfig,
    onLoaded: (r) => setPaymentsLive(r.paymentsLive),
  });

  const dirty = cfg.story_min_followers !== saved.story_min_followers;
  const patch = (next: Partial<StoriesConfig>) => {
    setCfg((c) => ({ ...c, ...next }));
    setOk(false);
    setConfirming(false);
  };
  const askFirst = needsFloorConfirm(cfg.story_min_followers, saved.story_min_followers, paymentsLive);

  const save = () => {
    setConfirming(false);
    saveWith(async (c) => {
      const r = await updateStoriesConfig(c);
      if (r.ok) setPaymentsLive(r.paymentsLive);
      return r;
    });
  };
  const n = cfg.story_min_followers.toLocaleString("en-US");

  return (
    <div className="flex flex-col gap-4">
      <SectionCard
        icon={<Camera />}
        title="Real Stories"
        subtitle="Who can buy a Story voucher, and how long a real Story takes."
        right={<Chip tone={paymentsLive ? "warning" : "neutral"}>{paymentsLive ? "Payments: Live" : "Payments: Test"}</Chip>}
      >
        <div className="mt-5 flex flex-col gap-4">
          <NumberField
            label="Minimum followers"
            value={cfg.story_min_followers}
            min={0}
            max={STORY_MIN_FOLLOWERS_MAX}
            disabled={pending || loadBlocked}
            hint="Guests need this many Instagram followers or more."
            onChange={(v) => patch({ story_min_followers: v })}
          />
          <div className="grid grid-cols-2 gap-4">
            <ReadField label="Bonus wait" boxed>
              {formatDuration(cfg.story_bonus_wait_sec)} after the story is posted
            </ReadField>
            <ReadField label="Time to post" boxed>
              {formatDuration(cfg.story_post_window_sec)} from payment
            </ReadField>
          </div>
        </div>
      </SectionCard>

      {confirming && askFirst ? (
        <Notice tone="warning">
          <span className="flex flex-wrap items-center gap-3">
            <span className="min-w-0 flex-1">
              Lower the floor to {n} for real-money Stories? Guests with {n} or more followers will be able to buy.
            </span>
            <Button pending={pending} onClick={save}>Confirm</Button>
            <Button tone="secondary" onClick={() => setConfirming(false)}>Cancel</Button>
          </span>
        </Notice>
      ) : (
        <SaveRow
          pending={pending}
          dirty={dirty}
          ok={ok}
          onClick={askFirst ? () => setConfirming(true) : save}
          loadError={loadBlocked ? (error ?? "Failed to load Stories config") : null}
        />
      )}
      {error && !loadBlocked && <Notice>{error}</Notice>}
    </div>
  );
}
