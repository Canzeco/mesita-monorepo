"use client";

// General — the POST-GOOGLE WIPE, live. First box under the matrix because
// it runs LAST: whatever a Google Places query returned, and whatever Mesita
// row that result resolved to, has to clear these two before any mode shows
// it. Fast, Deep, Map, and the business/admin suggest merge all read it.
//
// A FILTER EXCLUDES; A SIGNAL DEMOTES. This is a filter, and it is
// Discovery-wide on purpose — copying it into four mode boxes is how two
// screens end up disagreeing about what "active" means.
//
// ONLY ACTIVE PLACES (Pato, 2026-08-29). Active is the Status-box fact:
// `business_status === "OPERATIONAL"` on Mesita, Google's `businessStatus`
// on a Google-only row. On-Mesita rows used to be waved through here — a
// place the operator had switched Active OFF still came back from search.
// That was the bug this box closes, so the switch defaults ON.
//
// Unknown does not clear either knob. A place with nothing to show has not
// proven it is open, and "only active places" cannot mean "plus the ones we
// couldn't check". The card says so under each control.

import { useEffect, useMemo, useState, useTransition } from "react";
import { CircleSlash2, MessageSquare, SlidersHorizontal } from "lucide-react";
import { ErrorNote } from "@/components/ErrorNote";
import { formatShortDate } from "@/lib/format";
import {
  KnobStatus,
  NumberField,
  SaveRow,
  SectionCard,
  Switch,
} from "@/components/admin-ui/config";
import { getDiscoveryConfig, updateDiscoveryConfig } from "./actions";
import {
  DEFAULT_CONFIG,
  GENERAL_MIN_REVIEWS_MAX,
  type DiscoveryConfig,
  type GeneralConfig,
} from "./catalog";

export function GeneralGateConfigClient({
  initialConfig,
  initialUpdatedAt,
  loadError,
}: {
  initialConfig: DiscoveryConfig;
  initialUpdatedAt: string | null;
  loadError: string | null;
}) {
  const [cfg, setCfg] = useState<DiscoveryConfig>(initialConfig);
  const [saved, setSaved] = useState<DiscoveryConfig>(initialConfig);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(loadError);
  const [loadBlocked, setLoadBlocked] = useState(!!loadError);
  const [ok, setOk] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(initialUpdatedAt);

  useEffect(() => {
    let active = true;
    (async () => {
      const r = await getDiscoveryConfig();
      if (!active) return;
      if (!r.ok) {
        if (loadBlocked) setError(r.error);
        return;
      }
      setCfg(r.config);
      setSaved(r.config);
      setUpdatedAt(r.updatedAt);
      setError(null);
      setLoadBlocked(false);
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed once on mount
  }, []);

  // Only this box's two knobs. The Google category count rides the same
  // `general` slice but is edited on Modules (Google types), so a stale
  // count must never light up Save here.
  const dirty = useMemo(
    () =>
      cfg.general.requireActive !== saved.general.requireActive ||
      cfg.general.minReviews !== saved.general.minReviews,
    [cfg.general, saved.general],
  );

  const patch = (p: Partial<GeneralConfig>) => {
    setOk(false);
    setCfg((c) => ({ ...c, general: { ...c.general, ...p } }));
  };

  const save = () => {
    if (loadBlocked) return;
    setError(null);
    startTransition(async () => {
      const r = await updateDiscoveryConfig(cfg, ["general"]);
      if (r.ok) {
        setSaved(r.config);
        setCfg(r.config);
        setUpdatedAt(r.updatedAt);
        setOk(true);
      } else {
        setError(r.error);
      }
    });
  };

  const general = cfg.general ?? DEFAULT_CONFIG.general;

  return (
    <div id="s-general" className="scroll-mt-16 flex flex-col gap-4">
      {error ? <ErrorNote message={error} /> : null}

      <SectionCard
        icon={<SlidersHorizontal className="text-primary h-4 w-4" />}
        title="General"
        subtitle="The wipe that runs after every Google Places query. Fast, Deep, and Map all apply it — to Google results and to the Mesita rows they resolve to."
        status={
          <KnobStatus
            kind="enforced"
            reason="Fast · Deep · Map · suggest-places"
          />
        }
      >
        <p className="text-muted-foreground mt-5 type-meta">
          A filter excludes; a signal demotes. These two cut the list Google
          just returned — they never reorder it, and nothing downstream can
          put a wiped place back.
        </p>

        <div className="mt-5 flex flex-col gap-3">
          <div className="border-border bg-background flex items-center justify-between gap-4 rounded-xl border p-4">
            <div className="flex min-w-0 items-start gap-2">
              <CircleSlash2 className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-semibold">Only active places</p>
                <p className="text-muted-foreground type-meta">
                  Active is Google&rsquo;s{" "}
                  <span className="text-foreground font-semibold">
                    OPERATIONAL
                  </span>{" "}
                  — the same fact the Status box shows. Temporarily and
                  permanently closed both go, and so does a place that
                  never told us: unknown is not active.
                </p>
              </div>
            </div>
            <Switch
              on={general.requireActive}
              pending={pending || loadBlocked}
              onClick={() => patch({ requireActive: !general.requireActive })}
              label="Only active places"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <NumberField
              icon={<MessageSquare className="mt-0.5 h-4 w-4 shrink-0" />}
              label="Minimum Google reviews"
              value={general.minReviews}
              min={0}
              max={GENERAL_MIN_REVIEWS_MAX}
              disabled={pending || loadBlocked}
              onChange={(minReviews) => patch({ minReviews })}
            />
          </div>
          <p className="text-muted-foreground type-meta">
            {general.minReviews > 0
              ? `Under ${general.minReviews} reviews is wiped, and so is a place with no review count — a floor asks a place to prove it clears the bar.`
              : "0 is off. Any number asks a place to prove the count; one with no review count is wiped too."}
          </p>
        </div>

        {updatedAt ? (
          <p className="text-muted-foreground mt-4 type-meta">
            Last saved {formatShortDate(updatedAt)}
          </p>
        ) : null}
        <SaveRow
          pending={pending}
          dirty={dirty}
          ok={ok}
          onClick={save}
          loadError={loadBlocked ? error : null}
        />
      </SectionCard>
    </div>
  );
}
