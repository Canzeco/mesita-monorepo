"use client";

import { useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { NumberField, SectionCard } from "@/components/admin-ui/config";
import { Fields } from "../blocks";
import { updateAtlasConfig } from "../actions";
import { CrenupSaveBar } from "../CrenupSaveBar";

// UPDATE EVERY N VIEWS (Pato, MESITA-2997: "every 10 visits, 20, 30 we
// update the place"). The same view count as "Enrich after N views" — each
// guest counts once per place — keeps going after Enrich, and every multiple
// of N runs Google Update. 0 turns it off. Update Reviews (MESITA-3159) has
// its own N on the same count, far larger: each run is an Apify scrape.
export function UpdatingClient({
  initialEveryViews,
  initialReviewsEveryViews,
  initialUpdatedAt,
  loadError,
}: {
  initialEveryViews: number;
  initialReviewsEveryViews: number;
  initialUpdatedAt: string | null;
  loadError: string | null;
}) {
  const [everyViews, setEveryViews] = useState(initialEveryViews);
  const [saved, setSaved] = useState(initialEveryViews);
  const [reviewsEvery, setReviewsEvery] = useState(initialReviewsEveryViews);
  const [reviewsSaved, setReviewsSaved] = useState(initialReviewsEveryViews);
  const [updatedAt, setUpdatedAt] = useState(initialUpdatedAt);
  const [error, setError] = useState<string | null>(loadError);
  const [ok, setOk] = useState(false);
  const [pending, startTransition] = useTransition();
  const blocked = loadError;

  function save() {
    startTransition(async () => {
      const r = await updateAtlasConfig({ updateEveryViews: everyViews, reviewsUpdateEveryViews: reviewsEvery });
      if (!r.ok) {
        setError(r.error);
        setOk(false);
        return;
      }
      setSaved(r.data.updateEveryViews);
      setEveryViews(r.data.updateEveryViews);
      setReviewsSaved(r.data.reviewsUpdateEveryViews);
      setReviewsEvery(r.data.reviewsUpdateEveryViews);
      setUpdatedAt(r.data.updatedAt);
      setError(null);
      setOk(true);
    });
  }

  return (
    <>
      <SectionCard icon={<RefreshCw className="text-secondary h-4 w-4" />} title="Update Google on views">
        <div className="mt-4">
          <Fields>
            <NumberField
              label="Update every N views"
              value={everyViews}
              min={0}
              max={1000}
              onChange={(v) => {
                setEveryViews(v);
                setOk(false);
              }}
              disabled={pending || !!blocked}
            />
          </Fields>
          <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
            Each time this many more different guests have opened a place&apos;s profile (
            {everyViews > 0
              ? `${everyViews}, ${everyViews * 2}, ${everyViews * 3}…`
              : "off"}
            ), its Google details refresh by themselves. Each guest counts once per place, the
            same count as Enrich after N views. 0 turns it off.
          </p>
        </div>
      </SectionCard>
      <SectionCard icon={<RefreshCw className="text-secondary h-4 w-4" />} title="Update Reviews on views">
        <div className="mt-4">
          <Fields>
            <NumberField
              label="Update Reviews every N views"
              value={reviewsEvery}
              min={0}
              max={1000}
              onChange={(v) => {
                setReviewsEvery(v);
                setOk(false);
              }}
              disabled={pending || !!blocked}
            />
          </Fields>
          <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
            On the same count (
            {reviewsEvery > 0 ? `${reviewsEvery}, ${reviewsEvery * 2}, ${reviewsEvery * 3}…` : "off"}
            ), the place&apos;s Google stars, up to 100 Google reviews and its Instagram and
            Facebook followers refresh by themselves. Keep it well above Update Google: each run
            is a paid Apify scrape. 0 turns it off.
          </p>
        </div>
      </SectionCard>
      <CrenupSaveBar
        blocked={blocked}
        dirty={everyViews !== saved || reviewsEvery !== reviewsSaved}
        ok={ok}
        pending={pending}
        settingsStamp={updatedAt}
        error={error}
        onDiscard={() => {
          setEveryViews(saved);
          setReviewsEvery(reviewsSaved);
          setError(null);
        }}
        onSave={save}
      />
    </>
  );
}
