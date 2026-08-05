"use client";

import { useEffect, useState, useTransition } from "react";
import { BadgeCheck, Phone } from "lucide-react";
import { ErrorNote } from "@/components/ErrorNote";
import { Switch } from "../enricher-config/atlas-ui";
import {
  getVerificationConfig,
  updateVerificationConfig,
  type VerificationConfig,
} from "./actions";

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
  const [pending, startTransition] = useTransition();
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

  const toggle = () => {
    const next = !cfg.createPlacesAsVerified;
    setError(null);
    // Optimistic: flip immediately, roll back on failure.
    setCfg({ createPlacesAsVerified: next });
    startTransition(async () => {
      const r = await updateVerificationConfig({
        createPlacesAsVerified: next,
      });
      if (!r.ok) {
        setCfg({ createPlacesAsVerified: !next });
        setError(r.error);
        return;
      }
      setCfg(r.config);
      setUpdatedAt(r.updatedAt);
    });
  };

  return (
    <div className="space-y-5">
      {error && <ErrorNote message={error} />}

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
          <p className="text-muted-foreground mt-2 flex items-start gap-1.5 text-[12px] leading-relaxed">
            <Phone className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Ownership verification (phone OTP / video) stays on the Verification
              Queue under Alerts. This toggle only sets the catalog badge at
              create time.
            </span>
          </p>
        </div>
        <Switch
          on={cfg.createPlacesAsVerified}
          pending={pending}
          onClick={toggle}
          label="Create new places as Verified Partner"
        />
      </div>

      {updatedAt && (
        <p className="text-muted-foreground text-[12px]">
          Last updated {new Date(updatedAt).toLocaleString()}
        </p>
      )}
    </div>
  );
}
