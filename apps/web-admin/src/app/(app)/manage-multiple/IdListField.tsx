"use client";

import { FileField, TextAreaField } from "@/components/admin-ui";
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
  return (
    <div className="flex flex-col gap-3">
      <TextAreaField
        id={id}
        label={label}
        value={text}
        disabled={running}
        rows={6}
        placeholder={"ChIJ...\nChIJ...\nChIJ..."}
        onChange={onTextChange}
      />
      <FileField
        label="Upload CSV / TXT"
        accept=".csv,.txt,text/csv,text/plain"
        disabled={running}
        onText={(content) => onTextChange(text ? `${text}\n${content}` : content)}
      >
        <span className="text-muted-foreground type-meta">
          {placeIds.length} valid ID{placeIds.length === 1 ? "" : "s"} detected
          {placeIds.length >= MAX_GOOGLE_PLACE_IDS
            ? ` (capped at ${MAX_GOOGLE_PLACE_IDS})`
            : ""}
        </span>
      </FileField>
    </div>
  );
}
