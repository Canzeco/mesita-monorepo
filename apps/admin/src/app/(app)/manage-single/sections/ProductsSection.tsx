"use client";

import { useMemo, useState, useTransition } from "react";
import { ExternalLink, UtensilsCrossed } from "lucide-react";
import { updatePlace, type AdminPlace } from "../actions";
import { ErrorNote, SaveBar, SectionCard, TextField } from "../ui";

const MENU_NAME_MAX = 80;

export function ProductsSection({
  place,
  onSaved,
}: {
  place: AdminPlace;
  onSaved: (v: AdminPlace) => void;
}) {
  // Parent remounts this section with key={place.id} when the operator switches
  // units, so initial state is always the active place's menu fields.
  const [name, setName] = useState(place.menu_pdf_name ?? "");
  const [url, setUrl] = useState(place.menu_pdf_url ?? "");
  const [savedName, setSavedName] = useState(name);
  const [savedUrl, setSavedUrl] = useState(url);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const dirty = useMemo(
    () => name !== savedName || url !== savedUrl,
    [name, url, savedName, savedUrl],
  );

  const save = () => {
    if (!dirty) return;
    const trimmedUrl = url.trim();
    if (trimmedUrl && !/^https:\/\//i.test(trimmedUrl)) {
      setError("Menu URL must be a valid https:// URL (or leave blank to clear).");
      return;
    }
    setError(null);
    setOk(false);
    start(async () => {
      const r = await updatePlace({
        id: place.id,
        menu_pdf_name: name.trim() ? name.trim().slice(0, MENU_NAME_MAX) : null,
        menu_pdf_url: trimmedUrl || null,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      const nextName = r.data.menu_pdf_name ?? "";
      const nextUrl = r.data.menu_pdf_url ?? "";
      setName(nextName);
      setUrl(nextUrl);
      setSavedName(nextName);
      setSavedUrl(nextUrl);
      onSaved(r.data);
      setOk(true);
    });
  };

  return (
    <SectionCard
      icon={<UtensilsCrossed className="text-muted-foreground h-4 w-4" />}
      title="Products"
      subtitle="Menu / catalog link shown to consumers. Name is optional display label; URL must be https or empty to clear."
    >
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <TextField
          label="Menu name"
          value={name}
          onChange={(v) => setName(v.slice(0, MENU_NAME_MAX))}
          placeholder="Dinner menu"
          maxLength={MENU_NAME_MAX}
          disabled={pending}
        />
        <TextField
          label="Menu URL"
          value={url}
          onChange={setUrl}
          placeholder="https://…"
          disabled={pending}
        />
      </div>
      {url.trim() && /^https:\/\//i.test(url.trim()) ? (
        <a
          href={url.trim()}
          target="_blank"
          rel="noreferrer"
          className="text-secondary mt-3 inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
        >
          Open menu <ExternalLink className="h-3.5 w-3.5" />
        </a>
      ) : null}
      {error ? <ErrorNote message={error} /> : null}
      <SaveBar pending={pending} dirty={dirty} ok={ok} onSave={save} />
    </SectionCard>
  );
}
