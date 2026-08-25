"use client";

import { KnobStatus } from "@/components/admin-ui/config";
import { formatShortDate } from "@/lib/format";
import { ALLOWED_CAPS } from "./promos";
import { usePromosState } from "./PromosState";

export function DiscountCapClient() {
  const { cfg, setCap, pending, updatedAt } = usePromosState();

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <KnobStatus kind="fallback" reason="place cap wins" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {ALLOWED_CAPS.map((c) => {
          const active = cfg.cap === c;
          return (
            <button
              key={c}
              type="button"
              disabled={pending}
              onClick={() => setCap(c)}
              aria-pressed={active}
              className={
                active
                  ? "bg-foreground text-background inline-flex h-9 items-center rounded-lg px-3.5 type-body font-bold tabular-nums transition disabled:opacity-50"
                  : "border-border text-muted-foreground hover:text-foreground hover:bg-muted inline-flex h-9 items-center rounded-lg border px-3.5 type-body font-semibold tabular-nums transition disabled:opacity-50"
              }
            >
              {c.toLocaleString("en-US")}
            </button>
          );
        })}
      </div>
      {updatedAt && (
        <p className="text-muted-foreground text-right text-xs">
          Updated {formatShortDate(updatedAt)}
        </p>
      )}
    </>
  );
}
