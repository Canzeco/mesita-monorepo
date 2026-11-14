"use client";

// /me/integrations/mcp (MESITA-3971, Pato: "ONLY THESE ONES. BUT ACTUALLY
// MAKE THEM WORK"). The guest's private connector URL and how to add it to
// Claude or ChatGPT. Through it an assistant can search Mesita's places,
// open one, and read the guest's reservations — never book or change one.

import { useState } from "react";
import { Copy, RefreshCw } from "lucide-react";
import { MeScreen } from "@/components/consumer/me/MeScreen";
import {
  MeLead,
  RowDivider,
  SettingsActionRow,
  SettingsGroup,
} from "@/components/consumer/me/settings-rows";
import { LocalDialog } from "@/components/consumer/overlay/LocalOverlay";
import { apiGetMcpLink, type McpLink } from "@/lib/api/mcp";
import { writeCached } from "@/lib/screen-cache";
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";
import { toast } from "@/lib/toast";
import {
  SHEET_BODY_CLASS,
  SHEET_CANCEL_BUTTON_CLASS,
  SHEET_TITLE_CLASS,
} from "@/lib/ui-classes";
import { useCachedQuery } from "@/lib/use-cached-query";
import { errMsg } from "@/lib/utils";

const KEY = "mcp-link";

const STEPS: Array<{ app: string; steps: string[] }> = [
  {
    app: "Claude",
    steps: [
      "Settings › Connectors › Add custom connector",
      "Name it Mesita and paste the link",
      "In a chat, turn Mesita on from the tools menu",
    ],
  },
  {
    app: "ChatGPT",
    steps: [
      "Settings › Apps & Connectors › Advanced › turn on Developer mode",
      "Create a connector: name Mesita, paste the link, No authentication",
      "In a chat, pick Mesita from the + menu",
    ],
  },
];

function lastUsedLine(at: string | null): string {
  if (!at) return "Not connected yet";
  const d = new Date(at);
  return `Last used ${d.toLocaleDateString(undefined, { day: "numeric", month: "short" })}`;
}

export function McpModal() {
  const getSupabase = useLazyBrowserSupabase();
  const link = useCachedQuery<McpLink>(KEY, () => apiGetMcpLink(getSupabase()), {
    ttl: 60_000,
  });
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const url = link.data?.url ?? null;

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied. Paste it in Claude or ChatGPT.");
    } catch {
      toast.error("Couldn't copy the link.");
    }
  };

  const reset = async () => {
    setBusy(true);
    try {
      writeCached(KEY, await apiGetMcpLink(getSupabase(), true));
      setConfirm(false);
      toast.success("New link made. Paste it in your assistant again.");
    } catch (e) {
      toast.error(errMsg(e, "Couldn't make a new link."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <MeScreen title="MCP">
      <MeLead>
        Ask Claude or ChatGPT about Mesita places and your reservations. They can
        read, never book or cancel.
      </MeLead>
      <div className="flex flex-col gap-6">
        <SettingsGroup title="Your link">
          <div className="px-4 py-3">
            <p
              className="text-foreground type-label font-mono break-all"
              aria-busy={!url}
            >
              {url ?? (link.error ? "Couldn't load your link." : "Making your link…")}
            </p>
            <p className="text-muted-foreground type-label mt-1">
              {url ? `Private: anyone with it can read your reservations. ${lastUsedLine(link.data?.last_used_at ?? null)}.` : " "}
            </p>
          </div>
          <RowDivider />
          <SettingsActionRow
            Icon={Copy}
            label="Copy link"
            sub="Paste it in Claude or ChatGPT"
            disabled={!url}
            onClick={copy}
          />
          <RowDivider />
          <SettingsActionRow
            Icon={RefreshCw}
            label="Make a new link"
            sub="The old one stops working"
            disabled={!url}
            onClick={() => setConfirm(true)}
          />
        </SettingsGroup>
        {STEPS.map((s) => (
          <SettingsGroup key={s.app} title={s.app}>
            <ol className="flex flex-col gap-2 px-4 py-3">
              {s.steps.map((step, i) => (
                <li key={step} className="type-label flex gap-2">
                  <span className="text-muted-foreground w-4 shrink-0 font-semibold">{i + 1}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </SettingsGroup>
        ))}
        {link.error && (
          <button type="button" onClick={link.reload} className="text-muted-foreground type-label underline">
            Couldn&apos;t load your link. Try again
          </button>
        )}
      </div>
      <LocalDialog open={confirm} onClose={() => setConfirm(false)} ariaLabel="Make a new link">
        <div className={SHEET_BODY_CLASS}>
          <h2 className={SHEET_TITLE_CLASS}>Make a new link?</h2>
          <p className="text-muted-foreground type-body mt-2 leading-snug">
            Claude or ChatGPT using the old link lose access. Paste the new one after.
          </p>
          <div className="mt-4 flex gap-2">
            <button type="button" onClick={() => setConfirm(false)} className={SHEET_CANCEL_BUTTON_CLASS}>
              Cancel
            </button>
            <button
              type="button"
              onClick={reset}
              disabled={busy}
              className="bg-foreground text-paper flex flex-1 items-center justify-center rounded-lg py-3 text-sm font-semibold transition disabled:opacity-60"
            >
              {busy ? "Making…" : "Make new link"}
            </button>
          </div>
        </div>
      </LocalDialog>
    </MeScreen>
  );
}
