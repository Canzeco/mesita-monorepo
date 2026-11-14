"use client";

import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "./button";
import { Notice } from "./notice";

/**
 * The one file picker (MESITA-3950): a hidden native input driven by a
 * secondary Button. `onText` gets the file's text; a read error shows as a
 * Notice under it. The input is cleared after each read, so picking the same
 * file twice reads it twice.
 */
export function FileField({
  label,
  accept,
  disabled,
  onText,
  children,
}: {
  /** The button's text. */
  label: string;
  accept?: string;
  disabled?: boolean;
  onText: (text: string, file: File) => void;
  /** Inline content after the button (a count, a hint). */
  children?: React.ReactNode;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      setError(null);
      onText(text, file);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read the file");
    } finally {
      if (ref.current) ref.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          tone="secondary"
          size="sm"
          disabled={disabled}
          icon={<Upload aria-hidden className="h-3.5 w-3.5" />}
          onClick={() => ref.current?.click()}
        >
          {label}
        </Button>
        <input ref={ref} type="file" accept={accept} onChange={onChange} className="hidden" />
        {children}
      </div>
      {error ? <Notice tone="error">{error}</Notice> : null}
    </div>
  );
}
