"use client";

import { useEffect, useState, useTransition } from "react";
import { BadgeCheck, Mail, Phone } from "lucide-react";
import { ErrorNote } from "@/components/ErrorNote";
import { SectionCard } from "@/components/admin-ui/config";
import { Switch } from "../enricher-config/atlas-ui";
import {
  getVerificationConfig,
  updateVerificationConfig,
  type VerificationConfig,
} from "./actions";

type KnobKey = keyof VerificationConfig;

// One clause each. The full account of what a proof is and who adjudicates it
// lives in Notion Docs, not on a page with three switches (MESITA-1176).
//
// `autoVerifyVideo` retired (MESITA-1248): the column, the type field, every
// backend touch point, and the orphan admin-web-set-auto-verify EF are all
// gone now, not just unrendered. It was GONE from the console for the same
// reason first — nothing ever read it, and admin-web-list-verifications
// showed every video row "regardless of auto_verify_video" — a knob that
// cannot be obeyed lies to the operator who flips it.
const KNOBS: {
  key: KnobKey;
  label: string;
  blurb: string;
  Icon: typeof Phone;
}[] = [
  {
    key: "createPlacesAsVerified",
    label: "Create new places as Mesita Partner",
    blurb: "Off, a new place reads Not Verified until someone proves ownership.",
    Icon: BadgeCheck,
  },
  {
    key: "autoVerifyAiCall",
    label: "Auto-confirm phone OTP",
    blurb: "Off, a correct code still waits on the Verification Queue.",
    Icon: Phone,
  },
  {
    key: "autoVerifyAiEmail",
    label: "Auto-confirm email OTP",
    blurb: "Off, a correct code still waits on the Verification Queue.",
    Icon: Mail,
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
    <>
      {error && <ErrorNote message={error} />}
      <SectionCard
        icon={<BadgeCheck className="h-4 w-4" />}
        title="Verification"
        subtitle="Who may prove they own a place, and whether a correct code grants it outright or waits on the queue."
      >
        <div className="mt-5 flex flex-col gap-2">
          {KNOBS.map((k) => (
            <div
              key={k.key}
              className="border-border bg-background flex items-center justify-between gap-4 rounded-xl border p-4"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold">{k.label}</p>
                <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
                  {k.blurb}
                </p>
              </div>
              <Switch
                on={cfg[k.key]}
                pending={pendingKey === k.key}
                onClick={() => toggle(k.key)}
                label={k.label}
              />
            </div>
          ))}
        </div>
        {updatedAt ? (
          <p className="text-muted-foreground mt-4 type-label">
            Each switch saves on click · last saved{" "}
            {new Date(updatedAt).toLocaleDateString()}
          </p>
        ) : null}
      </SectionCard>
    </>
  );
}
