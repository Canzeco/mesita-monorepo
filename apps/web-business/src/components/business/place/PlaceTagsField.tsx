"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { INPUT_CLASS as INPUT } from "@/lib/ui-classes";

const TAG_MAX_LEN = 40;
const TAG_MAX_COUNT = 20;

export function PlaceTagsField({
  value,
  onChange,
}: {
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const [draft, setDraft] = useState("");

  const addTag = (raw: string) => {
    const tag = raw.trim().toLowerCase().slice(0, TAG_MAX_LEN);
    if (!tag || value.includes(tag) || value.length >= TAG_MAX_COUNT) return;
    onChange([...value, tag]);
    setDraft("");
  };

  const removeTag = (tag: string) => {
    onChange(value.filter((item) => item !== tag));
  };

  return (
    <div className="flex flex-col gap-2">
      {value.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {value.map((tag) => (
            <li key={tag}>
              <span className="border-border/60 bg-muted/35 inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium">
                {tag}
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  aria-label={`Remove ${tag}`}
                  className="text-muted-foreground hover:text-foreground transition"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            addTag(draft);
          }
        }}
        onBlur={() => {
          if (draft.trim()) addTag(draft);
        }}
        placeholder={
          value.length >= TAG_MAX_COUNT
            ? "Tag limit reached"
            : "Add a tag and press Enter"
        }
        disabled={value.length >= TAG_MAX_COUNT}
        className={cn(
          INPUT,
          "h-10 text-[13px] placeholder:text-muted-foreground/50",
          value.length >= TAG_MAX_COUNT && "cursor-not-allowed opacity-60",
        )}
      />
      <p className="text-muted-foreground text-[10px] tabular-nums">
        {value.length}/{TAG_MAX_COUNT}
      </p>
    </div>
  );
}
