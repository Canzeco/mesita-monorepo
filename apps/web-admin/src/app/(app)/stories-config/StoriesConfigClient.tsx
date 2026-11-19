"use client";

// Admin › Configurations › Stories (MESITA-4425). Card "Real Stories": the
// payments mode, the follower floor, and the real bonus wait and time to
// post, read-only (real-money rules; they go by migration). Card "Emulator"
// (MESITA-4426): the switch, what it does right now (the server's effective
// flag: switch on, test payments, Meta off), and the test Story's waits.
//
// Saving a floor LOWER than the saved one and below 1,000 while payments are
// live asks first, inline above Save. The EF logs every save with the admin.

import { useMemo, useState } from "react";
import { Camera, FlaskConical } from "lucide-react";
import { Button, Chip, Notice, NumberField, ReadField, SectionCard, SwitchRow } from "@/components/admin-ui";
import { SaveRow } from "@/components/admin-ui/config";
import { useConfigEditor } from "@/components/admin-ui/use-config-editor";
import { getStoriesConfig, updateStoriesConfig } from "./actions";
import {
  EMULATOR_BONUS_WAIT,
  EMULATOR_POST_WINDOW,
  emulatorStatus,
  formatDuration,
  needsFloorConfirm,
  type StoriesConfig,
  STORY_MIN_FOLLOWERS_MAX,
} from "./catalog";

export function StoriesConfigClient({
  initialConfig,
  initialPaymentsLive,
  initialStoryMode,
  loadError,
}: {
  initialConfig: StoriesConfig;
  initialPaymentsLive: boolean;
  initialStoryMode: string | null;
  loadError: string | null;
}) {
  const [paymentsLive, setPaymentsLive] = useState(initialPaymentsLive);
  const [storyMode, setStoryMode] = useState(initialStoryMode);
  const [confirming, setConfirming] = useState(false);
  const { cfg, setCfg, saved, setOk, pending, error, loadBlocked, ok, saveWith } = useConfigEditor({
    initialConfig,
    loadError,
    load: getStoriesConfig,
    onLoaded: (r) => {
      setPaymentsLive(r.paymentsLive);
      setStoryMode(r.storyMode);
    },
  });

  const dirty = useMemo(() => JSON.stringify(cfg) !== JSON.stringify(saved), [cfg, saved]);
  const patch = (next: Partial<StoriesConfig>) => {
    setCfg((c) => ({ ...c, ...next }));
    setOk(false);
    setConfirming(false);
  };
  const emu = emulatorStatus(cfg.story_emulator, paymentsLive, storyMode);
  const askFirst = needsFloorConfirm(cfg.story_min_followers, saved.story_min_followers, paymentsLive);

  const save = () => {
    setConfirming(false);
    saveWith(async (c) => {
      const r = await updateStoriesConfig(c);
      if (r.ok) {
        setPaymentsLive(r.paymentsLive);
        setStoryMode(r.storyMode);
      }
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
              {formatDuration(cfg.story_bonus_wait_sec)} after the waiter approves
            </ReadField>
            <ReadField label="Time to post" boxed>
              {formatDuration(cfg.story_post_window_sec)} from payment
            </ReadField>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        icon={<FlaskConical />}
        title="Emulator"
        subtitle="Test every Story workflow in minutes, without Instagram or a waiter."
        right={<Chip tone={emu.active ? "success" : "neutral"}>{emu.active ? "Active" : "Inactive"}</Chip>}
      >
        <div className="mt-5 flex flex-col gap-4">
          <SwitchRow
            label="Emulator mode"
            hint="Any guest with Instagram can buy, whatever the followers or a private account. Stories are faked with Tag the place and approved with Simulate the waiter."
            checked={cfg.story_emulator}
            disabled={pending || loadBlocked}
            onCheckedChange={(on) => patch({ story_emulator: on })}
          />
          <p className={emu.active ? "text-sm font-medium" : "text-muted-foreground text-sm"} data-emulator-status>
            {emu.line}
          </p>
          {emu.active ? (
            <p className="text-muted-foreground text-sm">
              Test it: buy a Story voucher on any place, then use Tag the place and Simulate the waiter on the Story screen.
            </p>
          ) : null}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <NumberField
              label="Emulator bonus wait (seconds)"
              value={cfg.story_emulator_bonus_wait_sec}
              min={EMULATOR_BONUS_WAIT.min}
              max={EMULATOR_BONUS_WAIT.max}
              disabled={pending || loadBlocked || !cfg.story_emulator}
              hint={`${formatDuration(cfg.story_emulator_bonus_wait_sec)} after the waiter approves a test story.`}
              onChange={(v) => patch({ story_emulator_bonus_wait_sec: v })}
            />
            <NumberField
              label="Emulator time to post (seconds)"
              value={cfg.story_emulator_post_window_sec}
              min={EMULATOR_POST_WINDOW.min}
              max={EMULATOR_POST_WINDOW.max}
              disabled={pending || loadBlocked || !cfg.story_emulator}
              hint={`${formatDuration(cfg.story_emulator_post_window_sec)} from payment to post and get approved.`}
              onChange={(v) => patch({ story_emulator_post_window_sec: v })}
            />
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
