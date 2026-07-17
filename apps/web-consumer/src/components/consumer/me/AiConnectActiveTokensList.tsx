"use client";

import { KeyRound, Loader2, Trash2 } from "lucide-react";
import {
  IconCircle,
  RowDivider,
  SettingsGroup,
} from "@/components/consumer/me/settings-rows";
import type { McpTokenMeta } from "@/lib/api/mcp-tokens";

export function ActiveTokensList({
  loading,
  tokens,
  onRevoke,
}: {
  loading: boolean;
  tokens: McpTokenMeta[];
  onRevoke: (id: string) => void;
}) {
  return (
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
                onClick={() => onRevoke(t.id)}
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
  );
}
