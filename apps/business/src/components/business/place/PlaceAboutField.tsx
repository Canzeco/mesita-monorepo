"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import {
  PLACE_DESCRIPTION_MAX,
  PLACE_DESCRIPTION_PLACEHOLDER,
} from "./place-utils";
import { TEXTAREA_CLASS as TEXTAREA } from "@/lib/ui-classes";

const MIN_HEIGHT = 160;
const MAX_HEIGHT = 320;

export function PlaceAboutField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const nearLimit = value.length > PLACE_DESCRIPTION_MAX * 0.9;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, el.scrollHeight))}px`;
  }, [value]);

  return (
    <div className="relative">
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={PLACE_DESCRIPTION_MAX}
        placeholder={PLACE_DESCRIPTION_PLACEHOLDER}
        rows={7}
        className={cn(
          TEXTAREA,
          "min-h-[160px] max-h-[320px] resize-none overflow-y-auto pb-7 text-[13px] leading-relaxed",
        )}
      />
      <span
        className={cn(
          "text-muted-foreground pointer-events-none absolute right-3 bottom-2 text-[10px] tabular-nums",
          nearLimit && "text-amber-700",
        )}
      >
        {value.length}/{PLACE_DESCRIPTION_MAX}
      </span>
    </div>
  );
}
