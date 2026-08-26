"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { MessageSquare } from "lucide-react";
import { ErrorNote } from "@/components/ErrorNote";
import { formatShortDate } from "@/lib/format";
import { SaveRow, SectionCard, TextAreaField } from "@/components/admin-ui/config";
import { getDiscoveryConfig, updateDiscoveryConfig } from "./actions";
import {
  CHAT_CONNECTIONS,
  CHAT_INDEXES,
  CHAT_LATER,
  CHAT_PROMPT_MAX,
  type DiscoveryConfig,
} from "./catalog";

function InventoryList({
  title,
  rows,
}: {
  title: string;
  rows: readonly { name: string; note: string; status?: string }[];
}) {
  return (
    <div className="mt-5">
      <p className="text-foreground type-meta font-semibold tracking-wide uppercase">
        {title}
      </p>
      <ul className="border-border mt-2 divide-y rounded-xl border">
        {rows.map((row) => (
          <li
            key={row.name}
            className="flex flex-col gap-1 px-3 py-2.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
          >
            <div className="min-w-0">
              <p className="text-foreground text-sm font-medium">{row.name}</p>
              <p className="text-muted-foreground mt-0.5 type-label leading-relaxed">
                {row.note}
              </p>
            </div>
            {row.status ? (
              <span className="border-border text-muted-foreground w-fit shrink-0 rounded-full border px-2 py-0.5 type-meta font-semibold tracking-wide uppercase">
                {row.status}
              </span>
            ) : (
              <span className="border-border text-muted-foreground w-fit shrink-0 rounded-full border px-2 py-0.5 type-meta font-semibold tracking-wide uppercase">
                Later
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

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
        subtitle="Every turn sends this prompt plus the entire guest thread as plain text. Connections below are the map for later — only OpenAI is live. Blank prompt uses the in-code Memo persona."
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
        <InventoryList title="APIs" rows={CHAT_CONNECTIONS} />
        <InventoryList title="Indexes (this pass: two)" rows={CHAT_INDEXES} />
        <InventoryList title="Later" rows={CHAT_LATER} />
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
