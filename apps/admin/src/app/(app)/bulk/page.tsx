"use client";

import { useState } from "react";
import { ListFilter, ListPlus, ListChecks } from "lucide-react";
import { SearchTab } from "./SearchTab";
import { CreateTab } from "./CreateTab";
import { UpdateTab } from "./UpdateTab";

type TabKey = "search" | "create" | "update";

const TABS: { key: TabKey; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "search", label: "Search", Icon: ListFilter },
  { key: "create", label: "Create", Icon: ListPlus },
  { key: "update", label: "Update", Icon: ListChecks },
];

// "Manage Multiple Units" — the three bulk tools (search / create / update)
// consolidated behind one nav item. Each tab renders its own tool body; the
// shared header + tab bar live here so the page reads as a single surface.
export default function ManageMultipleUnitsPage() {
  const [tab, setTab] = useState<TabKey>("search");

  return (
    <div className="mx-auto max-w-5xl px-8 pt-12 pb-24">
      <header>
        <p className="text-muted-foreground text-xs font-medium tracking-[0.14em] uppercase">
          Units · Multiple
        </p>
        <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
          Manage Multiple Units
        </h1>
      </header>

      <div
        role="tablist"
        aria-label="Bulk tools"
        className="border-border mt-6 flex gap-1 border-b"
      >
        {TABS.map(({ key, label, Icon }) => {
          const active = tab === key;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(key)}
              className={
                "-mb-px inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition " +
                (active
                  ? "border-secondary text-secondary"
                  : "text-muted-foreground hover:text-foreground border-transparent")
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          );
        })}
      </div>

      <div className="mt-8">
        {tab === "search" && <SearchTab />}
        {tab === "create" && <CreateTab />}
        {tab === "update" && <UpdateTab />}
      </div>
    </div>
  );
}
