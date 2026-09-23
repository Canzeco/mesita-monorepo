"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, KeyRound, Loader2, RefreshCw } from "lucide-react";
import { useRailScopeContext } from "@/components/console/RailScopeContext";
import { findPlace } from "@/lib/active-place";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { toast } from "@/lib/toast";
import { errMsg } from "@/lib/utils";
import { TINY_LABEL_CLASS } from "@/lib/ui-classes";
import {
  apiCreatePlaceApiKey,
  apiListPlaceApiKeys,
  apiRevokePlaceApiKey,
  type PlaceApiKeyMeta,
  type PlaceApiKeyMinted,
} from "@/lib/api/place-api-keys";

export function PlaceApiKeysPanel({ placeId }: { placeId: string }) {
  const supabase = useBrowserSupabase();
  const railPlaces = useRailScopeContext()?.places ?? [];
  const myRole = findPlace(railPlaces, placeId)?.myRole ?? null;
  const isOwner = myRole === "owner";

  const [keys, setKeys] = useState<PlaceApiKeyMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [fresh, setFresh] = useState<PlaceApiKeyMinted | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await apiListPlaceApiKeys(supabase, placeId);
      setKeys(list.filter((k) => !k.revoked_at));
    } catch (e) {
      toast(errMsg(e, "Couldn't load API keys."));
    } finally {
      setLoading(false);
    }
  }, [placeId, supabase]);

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      void refresh();
    });
    return () => cancelAnimationFrame(raf);
  }, [refresh]);

  async function mint(rotate: boolean) {
    if (!isOwner) {
      toast("Only owners can mint or rotate API keys.");
      return;
    }
    setBusy(true);
    setFresh(null);
    try {
      const key = await apiCreatePlaceApiKey(supabase, placeId, { rotate });
      setFresh(key);
      await refresh();
      toast(rotate ? "New API key issued — copy it now." : "API key created.");
    } catch (e) {
      toast(errMsg(e, "Couldn't create an API key."));
    } finally {
      setBusy(false);
    }
  }

  async function revoke(keyId: string) {
    if (!isOwner) return;
    setBusy(true);
    try {
      await apiRevokePlaceApiKey(supabase, placeId, keyId);
      setFresh(null);
      await refresh();
      toast("API key revoked.");
    } catch (e) {
      toast(errMsg(e, "Couldn't revoke the key."));
    } finally {
      setBusy(false);
    }
  }

  const active = keys[0] ?? null;

  return (
    <div className="flex flex-col gap-3">
      {loading ? (
        <p className="text-muted-foreground flex items-center gap-2 px-1 text-[12px]">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          Loading keys…
        </p>
      ) : active ? (
        <div className="border-border bg-page flex flex-wrap items-center gap-3 rounded-xl border p-3">
          <KeyRound
            className="text-muted-foreground h-4 w-4 shrink-0"
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <p className={TINY_LABEL_CLASS}>Active key</p>
            <p className="mt-1 font-mono text-[13px] tracking-tight">
              {active.key_prefix}…
            </p>
            <p className="text-muted-foreground mt-1 text-[11px]">
              {active.label} · created{" "}
              {new Date(active.created_at).toLocaleDateString()}
            </p>
          </div>
          {isOwner ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void mint(true)}
              className="border-border hover:bg-muted/60 inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] font-medium"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden />
              Rotate
            </button>
          ) : null}
        </div>
      ) : (
        <p className="text-muted-foreground px-1 text-[12px]">
          No active key yet.
          {isOwner ? " Mint one to connect a POS or script." : null}
        </p>
      )}

      {fresh ? (
        <div className="border-amber-500/40 bg-amber-500/5 rounded-xl border p-3">
          <p className="text-[12px] font-medium">Copy this key now</p>
          <p className="text-muted-foreground mt-1 text-[11px] leading-snug">
            It will not be shown again. Anything still on the old key stops
            working after a rotate.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="bg-page border-border max-w-full truncate rounded-md border px-2 py-1 font-mono text-[11px]">
              {fresh.token}
            </code>
            <button
              type="button"
              className="border-border hover:bg-muted/60 inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-medium"
              onClick={() => {
                void navigator.clipboard.writeText(fresh.token);
                toast("Copied.");
              }}
            >
              <Copy className="h-3 w-3" aria-hidden />
              Copy
            </button>
          </div>
        </div>
      ) : null}

      {isOwner && !active ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void mint(false)}
          className="bg-foreground text-background hover:opacity-90 inline-flex w-fit items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <KeyRound className="h-4 w-4" aria-hidden />
          )}
          Mint API key
        </button>
      ) : null}

      {isOwner && active && !fresh ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void revoke(active.id)}
          className="text-muted-foreground hover:text-foreground w-fit text-[12px] underline-offset-2 hover:underline disabled:opacity-50"
        >
          Revoke without replacing
        </button>
      ) : null}
    </div>
  );
}
