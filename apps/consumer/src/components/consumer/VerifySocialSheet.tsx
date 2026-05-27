"use client";

import { useState } from "react";
import { BadgeCheck, Instagram, Linkedin } from "lucide-react";
import { cn } from "@/lib/utils";

// Bottom-sheet flow for verifying a social account (Instagram or
// LinkedIn). Extracted from ProfileClient so the 130-line component
// doesn't have to live alongside the rest of the profile tabs — both
// platforms share the same five-step UX so the divergence is just copy
// + icon, captured in the `cfg` switch below.

export type SocialPlatform = "instagram" | "linkedin";

export function VerifySocialSheet({
  platform,
  onClose,
}: {
  platform: SocialPlatform;
  onClose: () => void;
}) {
  const [code, setCode] = useState("");
  const cfg =
    platform === "instagram"
      ? {
          Icon: Instagram,
          iconBg:
            "bg-[linear-gradient(135deg,oklch(0.70_0.20_30),oklch(0.65_0.20_350))]",
          title: "Verify Instagram",
          handle: "@mesita.bot",
          platformLabel: "Instagram",
          dmInstruction: (
            <>
              DM <span className="text-secondary">@mesita.bot</span> with the
              word <span className="text-secondary font-mono">VERIFY</span>.
            </>
          ),
          followInstruction: (
            <>
              Follow <span className="text-secondary">@mesita.bot</span> on
              Instagram.
            </>
          ),
        }
      : {
          Icon: Linkedin,
          iconBg: "bg-[#0A66C2]",
          title: "Verify LinkedIn",
          handle: "Mesita",
          platformLabel: "LinkedIn",
          dmInstruction: (
            <>
              Message <span className="text-secondary">Mesita</span> on
              LinkedIn with the word{" "}
              <span className="text-secondary font-mono">VERIFY</span>.
            </>
          ),
          followInstruction: (
            <>
              Connect with <span className="text-secondary">Mesita</span> on
              LinkedIn.
            </>
          ),
        };
  const { Icon } = cfg;
  return (
    <div className="absolute inset-0 z-50 flex items-end">
      <div
        className="bg-foreground/30 absolute inset-0 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div className="bg-card shadow-elev relative z-10 w-full rounded-t-3xl p-5">
        <div className="bg-foreground/30 mx-auto mb-3 h-1 w-12 rounded-full" />
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white",
              cfg.iconBg,
            )}
          >
            <Icon className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-display text-xl font-semibold tracking-tight">
              {cfg.title}
            </h2>
            <p className="text-muted-foreground text-[12px]">
              via <span className="text-foreground">{cfg.handle}</span> ·
              1-minute setup
            </p>
          </div>
        </div>
        <ol className="mt-5 flex flex-col gap-3">
          {[
            cfg.followInstruction,
            cfg.dmInstruction,
            <>
              Mesita will reply with an 8-digit verification code. Paste it
              here.
            </>,
            <>Your class is set instantly from your follower count.</>,
          ].map((line, i) => (
            <li
              key={i}
              className="flex items-start gap-3 text-[13px] leading-snug"
            >
              <span className="bg-secondary/15 text-secondary flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold">
                {i + 1}
              </span>
              <span>{line}</span>
            </li>
          ))}
        </ol>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Paste 8-digit code"
          className="border-border bg-muted/30 placeholder:text-muted-foreground/70 mt-4 h-12 w-full rounded-full border px-5 text-center text-sm outline-none"
          maxLength={8}
        />
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="border-border bg-card hover:bg-muted flex-1 rounded-full border py-3 text-sm font-semibold transition"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={code.length < 8}
            className="bg-pink-gradient flex flex-1 items-center justify-center gap-2 rounded-full py-3 text-sm font-semibold text-white transition disabled:opacity-60"
          >
            <BadgeCheck className="h-4 w-4" />
            Verify
          </button>
        </div>
        <p className="text-muted-foreground mt-3 text-center text-[11px]">
          We never ask for your {cfg.platformLabel} password.
        </p>
      </div>
    </div>
  );
}
