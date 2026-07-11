"use client";

import { useCallback, useEffect, useState } from "react";
import { Bot, Copy, Crown, KeyRound, Loader2, Trash2 } from "lucide-react";
import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import {
  IconCircle,
  RowDivider,
  SettingsGroup,
} from "@/components/consumer/me/settings-rows";
import { toast } from "@/lib/toast";
import { errMsg } from "@/lib/utils";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { useConsumerClass } from "@/lib/class-context";
import {
  apiCreateMcpToken,
  apiListMcpTokens,
  apiRevokeMcpToken,
  type McpTokenMeta,
  type McpTokenMinted,
} from "@/lib/api/mcp-tokens";

// Me → AI sheet: mint a Consumer MCP personal access token and show how to
// plug it into Claude / Cursor / any MCP client so an AI can control this
// Mesita profile (find places, book, check rewards).
//
// decision: Pato — real Consumer MCP, not a copy-paste tip (MESITA-265).
// decision: Pato — Premium-only (not Free) (MESITA-266).

function cursorSnippet(mcpUrl: string, token: string): string {
  return JSON.stringify(
    {
      mcpServers: {
        mesita: {
          url: mcpUrl,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      },
    },
    null,
    2,
  );
}

export function AiConnectModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const supabase = useBrowserSupabase();
  const { key: classKey } = useConsumerClass();
  const isPremium = classKey === "premium";
  const [tokens, setTokens] = useState<McpTokenMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [minting, setMinting] = useState(false);
  const [fresh, setFresh] = useState<McpTokenMinted | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await apiListMcpTokens(supabase);
      setTokens(list.filter((t) => !t.revoked_at));
    } catch (e) {
      toast(errMsg(e, "Couldn't load MCP tokens."));
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  // Load active tokens when the sheet opens. Fresh plaintext lives only in
  // this mount cycle — closing the sheet unmounts LocalSheet content via
  // `open`, and we clear `fresh` on the next mint instead of in an effect
  // (react-hooks/set-state-in-effect).
  useEffect(() => {
    if (!open) return;
    void refresh();
  }, [open, refresh]);

  async function mint() {
    if (!isPremium) {
      toast("AI connect is for Mesita Premium — upgrade to create a token");
      return;
    }
    setMinting(true);
    setFresh(null);
    try {
      const token = await apiCreateMcpToken(supabase, "AI client");
      setFresh(token);
      await refresh();
      toast.success("MCP token created — copy it now");
    } catch (e) {
      toast(errMsg(e, "Couldn't create MCP token."));
    } finally {
      setMinting(false);
    }
  }

  async function revoke(id: string) {
    try {
      await apiRevokeMcpToken(supabase, id);
      if (fresh?.id === id) setFresh(null);
      await refresh();
      toast("Token revoked");
    } catch (e) {
      toast(errMsg(e, "Couldn't revoke token."));
    }
  }

  async function copy(text: string, okMsg: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(okMsg);
    } catch {
      toast("Couldn't copy — select the text manually");
    }
  }

  return (
    <LocalSheet open={open} onClose={onClose} ariaLabel="Connect Mesita to AI">
      <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-violet-500/10 text-violet-600">
            <Bot className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-display flex items-center gap-2 text-xl font-semibold tracking-tight">
              AI
              <span className="border-border text-muted-foreground inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[8px] font-semibold tracking-[0.12em] uppercase">
                <Crown className="h-2.5 w-2.5 text-amber-600" />
                Premium
              </span>
            </h2>
            <p className="text-muted-foreground text-[12px]">
              Connect your Mesita profile to an AI
            </p>
          </div>
        </div>

        <p className="text-muted-foreground mt-4 text-[13px] leading-relaxed">
          Generate a personal access token, then add Mesita as an MCP server in
          Claude, Cursor, or ChatGPT. Your AI can then find places, save them,
          book tables, and check rewards — as you.{" "}
          <span className="text-foreground font-semibold">
            Available for Premium members only
          </span>
          — not on Free.
        </p>

        {!isPremium && (
          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3">
            <Crown className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
            <p className="text-[12px] leading-relaxed text-amber-950">
              You’re on Free. Upgrade to Mesita Premium to create an MCP token
              and let an AI control your profile.
            </p>
          </div>
        )}

        <div className="mt-5">
          <SettingsGroup>
            <button
              type="button"
              onClick={mint}
              disabled={minting || !isPremium}
              className="hover:bg-muted flex w-full items-center gap-3 px-4 py-3 text-left transition disabled:opacity-60"
            >
              <IconCircle tint="violet">
                {minting ? (
                  <Loader2 className="h-[18px] w-[18px] animate-spin" />
                ) : (
                  <KeyRound className="h-[18px] w-[18px]" />
                )}
              </IconCircle>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">
                  {minting
                    ? "Creating token…"
                    : isPremium
                      ? "Create MCP token"
                      : "Premium required"}
                </span>
                <span className="text-muted-foreground block truncate text-[11px]">
                  {isPremium
                    ? "Shown once — copy it into your AI client"
                    : "Upgrade to Premium to mint a token"}
                </span>
              </span>
            </button>
          </SettingsGroup>
        </div>

        {fresh && (
          <div className="border-border bg-card mt-4 overflow-hidden rounded-2xl border">
            <div className="border-border/60 border-b px-4 py-3">
              <p className="text-sm font-semibold">New token</p>
              <p className="text-muted-foreground text-[11px]">
                Copy now — Mesita won’t show the full token again
              </p>
            </div>
            <div className="space-y-3 px-4 py-3">
              <code className="bg-muted block break-all rounded-lg px-3 py-2 text-[11px] leading-relaxed">
                {fresh.token}
              </code>
              <button
                type="button"
                onClick={() =>
                  copy(fresh.token, "Token copied — paste into your AI client")
                }
                className="hover:bg-muted flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm font-semibold transition"
              >
                <Copy className="h-4 w-4 shrink-0" />
                Copy token
              </button>
              <div>
                <p className="text-muted-foreground mb-1 text-[11px] font-semibold tracking-wide uppercase">
                  MCP URL
                </p>
                <code className="bg-muted block break-all rounded-lg px-3 py-2 text-[11px]">
                  {fresh.mcp_url}
                </code>
              </div>
              <button
                type="button"
                onClick={() =>
                  copy(
                    cursorSnippet(fresh.mcp_url, fresh.token),
                    "Cursor / Claude config copied",
                  )
                }
                className="hover:bg-muted flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm font-semibold transition"
              >
                <Copy className="h-4 w-4 shrink-0" />
                Copy Cursor / Claude config
              </button>
            </div>
          </div>
        )}

        <div className="mt-5">
          <p className="text-foreground/60 mb-2 text-[10px] font-semibold tracking-[0.16em] uppercase">
            Active tokens
          </p>
          <SettingsGroup>
            {loading && tokens.length === 0 ? (
              <div className="text-muted-foreground flex items-center gap-2 px-4 py-3 text-[12px]">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Loading…
              </div>
            ) : tokens.length === 0 ? (
              <p className="text-muted-foreground px-4 py-3 text-[12px]">
                No active tokens yet.
              </p>
            ) : (
              tokens.map((t, i) => (
                <div key={t.id}>
                  {i > 0 && <RowDivider />}
                  <div className="flex items-center gap-3 px-4 py-3">
                    <IconCircle tint="muted">
                      <KeyRound className="h-[18px] w-[18px]" />
                    </IconCircle>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">
                        {t.label}
                      </span>
                      <span className="text-muted-foreground block truncate font-mono text-[11px]">
                        {t.token_prefix}…
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => void revoke(t.id)}
                      aria-label="Revoke token"
                      className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </SettingsGroup>
        </div>

        <p className="text-muted-foreground mt-4 text-[11px] leading-relaxed">
          Tools: get profile, suggest/get places, save places, list/create
          reservations, list rewards. Revoke anytime if a client is compromised.
        </p>
      </div>
    </LocalSheet>
  );
}
