"use client";

import { useEffect, useState, useTransition } from "react";
import { BadgeCheck, Mail, Phone, Video } from "lucide-react";
import { ErrorNote } from "@/components/ErrorNote";
import { Switch } from "../enricher-config/atlas-ui";
import {
  getVerificationConfig,
  updateVerificationConfig,
  type VerificationConfig,
} from "./actions";

type KnobKey = keyof VerificationConfig;

const OWNERSHIP_KNOBS: {
  key: KnobKey;
  label: string;
  blurb: string;
  Icon: typeof Phone;
}[] = [
  {
    key: "autoVerifyAiCall",
    label: "Auto-confirm phone OTP",
    blurb:
      "When on, picking up the call and reading the 6-digit code grants ownership instantly. When off, the code is still validated but the request lands on the Verification Queue for manual approval.",
    Icon: Phone,
  },
  {
    key: "autoVerifyAiEmail",
    label: "Auto-confirm email OTP",
    blurb:
      "When on, entering the email OTP grants ownership instantly. When off, the code is validated but the request lands on the Verification Queue for manual approval.",
    Icon: Mail,
  },
  {
    key: "autoVerifyVideo",
    label: "Auto-confirm video walkthrough",
    blurb:
      "When on, any submitted video URL grants ownership without review — for trusted operators only. When off, every video lands on the Verification Queue for a human to watch.",
    Icon: Video,
  },
];

export function VerificationConfigClient({
  initialConfig,
  initialUpdatedAt,
  loadError,
}: {
  initialConfig: VerificationConfig;
  initialUpdatedAt: string | null;
  loadError: string | null;
}) {
  const [cfg, setCfg] = useState<VerificationConfig>(initialConfig);
  const [pendingKey, setPendingKey] = useState<KnobKey | null>(null);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(loadError);
  const [updatedAt, setUpdatedAt] = useState<string | null>(initialUpdatedAt);

  // Re-fetch on mount so client-side nav shows the live row.
  useEffect(() => {
    let active = true;
    (async () => {
      const r = await getVerificationConfig();
      if (!active || !r.ok) return;
      setCfg(r.config);
      setUpdatedAt(r.updatedAt);
      setError(null);
    })();
    return () => {
      active = false;
    };
  }, []);

  const toggle = (key: KnobKey) => {
    if (pendingKey) return;
    const next = !cfg[key];
    const previous = cfg[key];
    setError(null);
    setCfg((c) => ({ ...c, [key]: next }));
    setPendingKey(key);
    startTransition(async () => {
      const r = await updateVerificationConfig({ [key]: next });
      setPendingKey(null);
      if (!r.ok) {
        setCfg((c) => ({ ...c, [key]: previous }));
        setError(r.error);
        return;
      }
      setCfg(r.config);
      setUpdatedAt(r.updatedAt);
    });
  };

  return (
    <div className="space-y-8">
      {error && <ErrorNote message={error} />}

      <section className="space-y-3">
        <div>
          <h2 className="font-display text-sm font-semibold tracking-tight">
            Partner badge
          </h2>
          <p className="text-muted-foreground mt-1 text-[13px] leading-relaxed">
            Catalog badge shown on place profiles. Separate from ownership proof.
          </p>
        </div>
        <div className="border-border bg-card flex items-start gap-4 rounded-2xl border p-5">
          <span
            className={
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-full " +
              (cfg.createPlacesAsVerified
                ? "bg-sky-500/15 text-sky-600"
                : "bg-muted text-muted-foreground")
            }
          >
            <BadgeCheck className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-base font-semibold tracking-tight">
              Create new places as Verified Partner
            </p>
            <p className="text-muted-foreground mt-1 text-[13px] leading-relaxed">
              When on, every newly created place shows the Verified Partner badge
              immediately — even though nobody entered the place&apos;s phone
              number to prove ownership. When off (default), new places show Not
              Verified until a paid plan grants partner status, or ownership is
              proven via phone OTP.
            </p>
          </div>
          <Switch
            on={cfg.createPlacesAsVerified}
            pending={pendingKey === "createPlacesAsVerified"}
            onClick={() => toggle("createPlacesAsVerified")}
            label="Create new places as Verified Partner"
          />
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="font-display text-sm font-semibold tracking-tight">
            Ownership auto-confirm
          </h2>
          <p className="text-muted-foreground mt-1 text-[13px] leading-relaxed">
            When off, successful OTP / video submissions wait on the Verification
            Queue under Alerts for a human decision.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3">
          {OWNERSHIP_KNOBS.map(({ key, label, blurb, Icon }) => {
            const on = cfg[key];
            return (
              <div
                key={key}
                className="border-border bg-card flex items-start gap-4 rounded-2xl border p-5"
              >
                <span
                  className={
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-full " +
                    (on
                      ? "bg-secondary/15 text-secondary"
                      : "bg-muted text-muted-foreground")
                  }
                >
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-display text-base font-semibold tracking-tight">
                    {label}
                  </p>
                  <p className="text-muted-foreground mt-1 text-[13px] leading-relaxed">
                    {blurb}
                  </p>
                </div>
                <Switch
                  on={on}
                  pending={pendingKey === key}
                  onClick={() => toggle(key)}
                  label={label}
                />
              </div>
            );
          })}
        </div>
      </section>

      {updatedAt && (
        <p className="text-muted-foreground text-[12px]">
          Last updated {new Date(updatedAt).toLocaleString()}
        </p>
      )}
    </div>
  );
}
