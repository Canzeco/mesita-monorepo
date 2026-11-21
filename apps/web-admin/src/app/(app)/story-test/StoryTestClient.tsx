"use client";

import { useState } from "react";
import { FlaskConical } from "lucide-react";
import { Chip, Notice, NumberField, SectionCard, SwitchRow } from "@/components/admin-ui";
import { SaveRow } from "@/components/admin-ui/config";
import { useConfigEditor } from "@/components/admin-ui/use-config-editor";
import { getStoriesConfig } from "@/app/(app)/stories-config/actions";
import {
  EMULATOR_BONUS_WAIT,
  EMULATOR_POST_WINDOW,
  emulatorStatus,
  formatDuration,
  type StoriesConfig,
} from "@/app/(app)/stories-config/catalog";
import { updateEmulatorConfig } from "./actions";

export function StoryTestClient({
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
  const { cfg, setCfg, saved, setOk, pending, error, loadBlocked, ok, saveWith } = useConfigEditor({
    initialConfig,
    loadError,
    load: getStoriesConfig,
    onLoaded: (r) => {
      setPaymentsLive(r.paymentsLive);
      setStoryMode(r.storyMode);
    },
  });

  const dirty =
    cfg.story_emulator !== saved.story_emulator ||
    cfg.story_emulator_bonus_wait_sec !== saved.story_emulator_bonus_wait_sec ||
    cfg.story_emulator_post_window_sec !== saved.story_emulator_post_window_sec;
  const patch = (next: Partial<StoriesConfig>) => {
    setCfg((c) => ({ ...c, ...next }));
    setOk(false);
  };
  const emu = emulatorStatus(cfg.story_emulator, paymentsLive, storyMode);
  const save = () => {
    saveWith(async (c) => {
      const r = await updateEmulatorConfig(c);
      if (r.ok) {
        setPaymentsLive(r.paymentsLive);
        setStoryMode(r.storyMode);
      }
      return r;
    });
  };

  return (
    <div className="flex flex-col gap-4">
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
              hint={`${formatDuration(cfg.story_emulator_bonus_wait_sec)} after a test story is posted.`}
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
      <SaveRow
        pending={pending}
        dirty={dirty}
        ok={ok}
        onClick={save}
        loadError={loadBlocked ? (error ?? "Failed to load Stories config") : null}
      />
      {error && !loadBlocked && <Notice>{error}</Notice>}
    </div>
  );
}
