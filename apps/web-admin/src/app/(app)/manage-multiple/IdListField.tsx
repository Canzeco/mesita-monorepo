"use client";

import { useRef } from "react";
import { Upload } from "lucide-react";
import { MAX_GOOGLE_PLACE_IDS } from "./google-place-ids";

export function IdListField({
  id,
  label,
  text,
  onTextChange,
  placeIds,
  running,
}: {
  id: string;
  label: string;
  text: string;
  onTextChange: (next: string) => void;
  placeIds: string[];
  running: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const content = await file.text();
    onTextChange(text ? `${text}\n${content}` : content);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div>
      <label className="text-sm font-medium" htmlFor={id}>
        {label}
      </label>
      <textarea
        id={id}
        value={text}
        disabled={running}
        rows={6}
        placeholder={"ChIJ...\nChIJ...\nChIJ..."}
        onChange={(e) => onTextChange(e.target.value)}
        className="border-border bg-background focus:border-foreground mt-2 w-full rounded-xl border px-3 py-2 font-mono text-xs leading-relaxed outline-none disabled:opacity-50"
      />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={running}
          className="border-border hover:border-foreground/40 inline-flex h-9 items-center gap-2 rounded-full border px-4 text-sm font-medium transition disabled:opacity-50"
        >
          <Upload className="h-3.5 w-3.5" />
          Upload CSV / TXT
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.txt,text/csv,text/plain"
          onChange={onFile}
          className="hidden"
        />
        <span className="text-muted-foreground text-xs">
          {placeIds.length} valid ID{placeIds.length === 1 ? "" : "s"} detected
          {placeIds.length >= MAX_GOOGLE_PLACE_IDS
            ? ` (capped at ${MAX_GOOGLE_PLACE_IDS})`
            : ""}
        </span>
      </div>
    </div>
  );
}
