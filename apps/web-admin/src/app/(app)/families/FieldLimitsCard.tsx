"use client";

// Atlas › Limits (MESITA-4581, Pato 2026-11-21: "two limits. One for on
// create, other for on enrich … LIMITS FOR BOTH FOR EACH FIELD"). How many
// Mesita Families, Presentation characters and Mesita tags the Description
// step keeps on Create and on Enrich, under the hard maximum the database and
// the editor enforce. Saved through the `enricher` config section.

import { useState } from "react";
import { Notice, NumberCell, SectionCard, Table, TBody, Td, Th, THead, Tr } from "@/components/admin-ui";
import { SaveRow } from "@/components/admin-ui/config";
import { saveFieldLimits, type FieldLimitsPatch } from "./actions";
import type { FieldLimitRow, FieldLimits } from "./highlight";

type Field = keyof FieldLimits;

const ROWS: { field: Field; label: string; unit: string; create: keyof FieldLimitsPatch; enrich: keyof FieldLimitsPatch }[] = [
  { field: "families", label: "Families per place", unit: "families", create: "createFamiliesMax", enrich: "enrichFamiliesMax" },
  { field: "presentation", label: "Presentation length", unit: "characters", create: "createPresentationMaxChars", enrich: "enrichPresentationMaxChars" },
  { field: "tags", label: "Tags per place", unit: "tags", create: "createTagsMax", enrich: "enrichTagsMax" },
];

export function FieldLimitsCard({ limits }: { limits: FieldLimits }) {
  const [saved, setSaved] = useState<FieldLimits>(limits);
  const [draft, setDraft] = useState<FieldLimits>(limits);
  const [pending, setPending] = useState(false);
  const [ok, setOk] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = ROWS.some(
    (r) => draft[r.field].create !== saved[r.field].create || draft[r.field].enrich !== saved[r.field].enrich,
  );

  function set(field: Field, stage: "create" | "enrich", value: number) {
    setOk(false);
    setDraft((d) => ({ ...d, [field]: { ...d[field], [stage]: value } }));
  }

  async function save() {
    setPending(true);
    setError(null);
    const patch: FieldLimitsPatch = {};
    for (const r of ROWS) {
      if (draft[r.field].create !== saved[r.field].create) patch[r.create] = draft[r.field].create;
      if (draft[r.field].enrich !== saved[r.field].enrich) patch[r.enrich] = draft[r.field].enrich;
    }
    const res = await saveFieldLimits(patch).catch((e) => ({ ok: false as const, error: e instanceof Error ? e.message : String(e) }));
    setPending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setSaved(draft);
    setOk(true);
  }

  return (
    <SectionCard
      title="Limits"
      subtitle={
        <>
          How much the Description step keeps on Create and on Enrich. The AI is asked for
          no more than the limit, and anything over it is dropped on save. Google Update
          writes none of these. Max is the hard ceiling.
        </>
      }
    >
      <div className="mt-4">
        <Table>
          <THead>
            <Tr>
              <Th>Field</Th>
              <Th className="text-right">Create</Th>
              <Th className="text-right">Enrich</Th>
              <Th className="text-right">Max</Th>
            </Tr>
          </THead>
          <TBody>
            {ROWS.map((r) => (
              <LimitRow
                key={r.field}
                label={r.label}
                unit={r.unit}
                row={draft[r.field]}
                disabled={pending}
                onChange={(stage, v) => set(r.field, stage, v)}
              />
            ))}
          </TBody>
        </Table>
      </div>
      {error && <Notice className="mt-4">{error}</Notice>}
      <SaveRow pending={pending} dirty={dirty} ok={ok} onClick={save} />
    </SectionCard>
  );
}

function LimitRow({
  label,
  unit,
  row,
  disabled,
  onChange,
}: {
  label: string;
  unit: string;
  row: FieldLimitRow;
  disabled: boolean;
  onChange: (stage: "create" | "enrich", value: number) => void;
}) {
  return (
    <Tr>
      <Td>
        {label}
        <span className="text-muted-foreground ml-2 text-sm">{unit}</span>
      </Td>
      <Td className="text-right">
        <NumberCell
          ariaLabel={`${label}, Create`}
          value={row.create}
          min={row.min}
          max={row.max}
          disabled={disabled}
          onChange={(v) => onChange("create", v)}
          className="ml-auto"
        />
      </Td>
      <Td className="text-right">
        <NumberCell
          ariaLabel={`${label}, Enrich`}
          value={row.enrich}
          min={row.min}
          max={row.max}
          disabled={disabled}
          onChange={(v) => onChange("enrich", v)}
          className="ml-auto"
        />
      </Td>
      <Td className="text-muted-foreground text-right tabular-nums">{row.max}</Td>
    </Tr>
  );
}
