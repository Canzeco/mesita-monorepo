"use client";

// Admin › Configurations › Stories (MESITA-4425). The follower floor and the
// real bonus wait and time to post, read-only. The emulator and the settle
// desk live on Extra › Story (MESITA-4522).
//
// Saving a floor LOWER than the saved one and below 1,000 while payments are
// live asks first, inline above Save. The EF logs every save with the admin.

import { useState } from "react";
import { Bot, Camera } from "lucide-react";
import { Button, Chip, Notice, NumberField, ReadField, SectionCard, SwitchRow } from "@/components/admin-ui";
import { SaveRow } from "@/components/admin-ui/config";
import { useConfigEditor } from "@/components/admin-ui/use-config-editor";
import { getStoriesConfig, updateStoriesConfig } from "./actions";
import { BOT_LIMITS, type BotLimitKey, formatDuration, needsFloorConfirm, type StoriesConfig, storiesDirty, STORY_MIN_FOLLOWERS_MAX } from "./catalog";

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

  const dirty = storiesDirty(saved, cfg);
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
          {/* No time to post since MESITA-4484; its dead field left with MESITA-4527. */}
          <ReadField label="Bonus wait" boxed>
            {formatDuration(cfg.story_bonus_wait_sec)} after the story is posted
          </ReadField>
        </div>
      </SectionCard>

      {/* MESITA-4549: the AI bot that checks every real story (MESITA-4535). */}
      <SectionCard icon={<Bot />} title="AI bot" subtitle="Checks that each real story tags the restaurant, then pays the bonus when the story is still up.">
        <div className="mt-5 flex flex-col gap-4">
          <SwitchRow
            label="Check stories"
            hint="Off pauses the bot. Stories wait in the queue and nothing is paid."
            checked={cfg.story_ai_enabled}
            disabled={pending || loadBlocked}
            onCheckedChange={(v) => patch({ story_ai_enabled: v })}
          />
          <SwitchRow
            label="Fetch each story before its bonus"
            hint="Off holds every real bonus and closes live Story sales."
            checked={cfg.story_recheck_meta}
            disabled={pending || loadBlocked}
            onCheckedChange={(v) => patch({ story_recheck_meta: v })}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {(Object.keys(BOT_LIMITS) as BotLimitKey[]).map((k) => (
              <NumberField
                key={k}
                label={BOT_LIMITS[k].label}
                value={cfg[k]}
                min={BOT_LIMITS[k].min}
                max={BOT_LIMITS[k].max}
                disabled={pending || loadBlocked}
                hint={BOT_LIMITS[k].hint}
                onChange={(v) => patch({ [k]: v } as Partial<StoriesConfig>)}
              />
            ))}
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
