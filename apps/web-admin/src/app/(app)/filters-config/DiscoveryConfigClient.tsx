"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { MessageSquare } from "lucide-react";
import { ErrorNote } from "@/components/ErrorNote";
import { formatShortDate } from "@/lib/format";
import { SaveRow, SectionCard, TextAreaField } from "@/components/admin-ui/config";
import { getDiscoveryConfig, updateDiscoveryConfig } from "./actions";
import { CHAT_PROMPT_MAX, type DiscoveryConfig } from "./catalog";

export function DiscoveryConfigClient({
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

  const dirty = useMemo(
    () => JSON.stringify(cfg.chat) !== JSON.stringify(saved.chat),
    [cfg, saved],
  );

  const save = () => {
    if (loadBlocked) return;
    setError(null);
    startTransition(async () => {
      const r = await updateDiscoveryConfig(cfg, ["chat"]);
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

  return (
    <div className="flex flex-col gap-4">
      {error ? <ErrorNote message={error} /> : null}

      <SectionCard
        icon={<MessageSquare className="text-secondary h-4 w-4" />}
        title="Chat"
        subtitle="Every turn sends this prompt plus the entire guest thread as plain text. That is the first pass — a cheaper ingest (rolling summary, retrieval, cached prefixes) is due. Blank uses the in-code Memo persona. No Places, Perplexity, or catalog tools yet."
        status={
          <div className="flex flex-col items-start gap-1 sm:items-end">
            <span className="border-border bg-muted text-muted-foreground rounded-full border px-2 py-0.5 type-meta font-semibold tracking-wide uppercase">
              Due · cheaper ingest
            </span>
            {updatedAt ? (
              <span className="text-muted-foreground text-xs">
                Updated {formatShortDate(updatedAt)}
              </span>
            ) : null}
          </div>
        }
      >
        <div className="mt-4">
          <TextAreaField
            label="Prompt"
            value={cfg.chat.prompt}
            disabled={pending || loadBlocked}
            rows={10}
            maxLength={CHAT_PROMPT_MAX}
            onChange={(prompt) => {
              setCfg((c) => ({ ...c, chat: { prompt } }));
              setOk(false);
            }}
          />
          <p className="text-muted-foreground mt-3 type-label max-w-3xl leading-relaxed">
            Context is the whole thread, resent every message. Do not treat
            that as the lasting design.
          </p>
        </div>
      </SectionCard>

      <SaveRow
        pending={pending}
        dirty={dirty}
        ok={ok}
        onClick={save}
        loadError={loadBlocked ? error : null}
      />
    </div>
  );
}
