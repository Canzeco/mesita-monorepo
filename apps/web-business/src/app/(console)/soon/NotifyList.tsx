"use client";

import { useState } from "react";
import { Bell, BellRing } from "lucide-react";
import { List } from "@/components/ui";
import { cn } from "@/lib/utils";

export function NotifyList({ items }: { items: { name: string; line: string }[] }) {
  const [on, setOn] = useState<Record<string, boolean>>({});
  return (
    <List>
      {items.map((it) => (
        <div key={it.name} className="flex items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <div className="font-medium">{it.name}</div>
            <div className="text-sm text-muted-foreground">{it.line}</div>
          </div>
          <button
            type="button"
            aria-pressed={!!on[it.name]}
            onClick={() => setOn((o) => ({ ...o, [it.name]: !o[it.name] }))}
            className={cn(
              "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-medium",
              on[it.name] ? "border-primary bg-brand-soft text-brand-text" : "border-border bg-card hover:bg-muted",
            )}
          >
            {on[it.name] ? <BellRing className="size-4" aria-hidden /> : <Bell className="size-4" aria-hidden />}
            {on[it.name] ? "We'll tell you" : "Notify me"}
          </button>
        </div>
      ))}
    </List>
  );
}
