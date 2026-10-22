"use client";

import { MeScreen } from "@/components/consumer/me/MeScreen";
import {
  SectionEyebrow,
  SettingsGroup,
} from "@/components/consumer/me/settings-rows";
import { Spinner } from "@/components/shared";
import { Instagram } from "@/components/shared/instagram-icon";
import { Skeleton, SkeletonLine } from "@/components/shared/Skeleton";
import { INSTAGRAM_REACH_FOLLOWERS } from "@/lib/consumer-identity";
import { useConsumerIdentity } from "@/lib/identity-context";
import { INSTAGRAM_ICON_GRADIENT_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";
import { SettingsRowSkeleton } from "../me-skeletons";

// /me/instagram's fallback: InstagramModal as it first paints (Pato,
// MESITA-2701: "the placeholders must be similar to the page you are
// loading, like the sizes").
//
// A CLIENT MODULE FOR ONE FACT: the page is two pages — the pitch for a
// guest with no Instagram, the account card for one with — and only the
// shell's identity context says which. It is seeded server-side, so the
// right one is drawn from the first frame.
//
//   not connected   Why connect (fixed words, as themselves), the page's
//                   own spinner while it asks how connecting works today,
//                   then Photo's switch row
//   connected       the account card (handle and status waiting), Social's
//                   and Photo's switch rows, then the one quiet link
//
// The switch rows' words are their first paint (on, before the read lands),
// drawn as themselves so they wrap where the rows' do. The pitch is
// InstagramModal's WHY_LINES, and the row words are SocialNameRow's and
// InstagramPhotoSwitch's; change them there and here.

const WHY_LINES = [
  `${INSTAGRAM_REACH_FOLLOWERS.toLocaleString("en-US")}+ followers and you're verified on Mesita — free, automatic, and nothing to apply for.`,
  "Your Mesita profile picture becomes your Instagram profile picture.",
] as const;

export function InstagramSkeleton() {
  const { igConnected: connected } = useConsumerIdentity();

  return (
    <MeScreen title="Instagram">
      <div className="mb-4 flex items-center gap-3">
        <span
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white",
            INSTAGRAM_ICON_GRADIENT_CLASS,
          )}
        >
          <Instagram className="h-5 w-5" />
        </span>
        <p className="text-muted-foreground text-xs">
          {INSTAGRAM_REACH_FOLLOWERS.toLocaleString("en-US")}+ followers
          verifies you.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {connected ? (
          <section className="flex flex-col gap-2">
            <SectionEyebrow>Connected</SectionEyebrow>
            <div className="border-border bg-card flex items-center gap-3 rounded-2xl border p-4">
              <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
              <div className="min-w-0 flex-1">
                <SkeletonLine className="text-sm" bar="w-28" />
                <SkeletonLine className="text-xs" bar="w-16" />
              </div>
            </div>
          </section>
        ) : (
          <>
            <article className="border-border bg-card rounded-2xl border p-4">
              <h3 className="text-sm leading-tight font-bold tracking-tight">
                Why connect
              </h3>
              <ul className="mt-2 flex flex-col gap-2">
                {WHY_LINES.map((line) => (
                  <li
                    key={line}
                    className="type-body flex items-start gap-2.5 leading-snug font-medium"
                  >
                    <span className="bg-secondary mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </article>
            <div className="flex justify-center py-6" aria-busy>
              <Spinner size="sm" />
            </div>
          </>
        )}

        {connected && (
          <SettingsGroup title="Social">
            <SettingsRowSkeleton
              label="Public profile"
              sub="You're visible in the Social feed"
              toggle
            />
          </SettingsGroup>
        )}

        <SettingsGroup title="Photo">
          <SettingsRowSkeleton
            label="Use my Instagram photo"
            sub="Your Mesita profile picture is your Instagram one"
            toggle
          />
        </SettingsGroup>

        {connected && (
          <>
            <div className="flex min-h-11 items-center">
              <SkeletonLine
                className="type-body w-full"
                bar="inset-x-0 mx-auto w-44"
              />
            </div>
            <p role="status" className="sr-only">
              Loading Instagram
            </p>
          </>
        )}
      </div>
    </MeScreen>
  );
}
