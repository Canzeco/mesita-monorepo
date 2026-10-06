"use client";

// DIGITAL MENU — hosted here, not a PDF (Main §4).
//
// Categories and dishes are edited in the desk. Publish stamps the version
// Orders, the Agent and the Express Website read. The guest page at /m/<slug>
// is that version.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { QrCode } from "lucide-react";
import { Group } from "@/components/shared/Group";
import { Rule } from "@/components/shared/Rule";
import { Badge } from "@/components/shared/Badges";
import { Table, type Column, type TableGroup } from "@/components/shared/Table";
import { usePlaceScope } from "@/components/console/PlaceScope";
import { day } from "@/lib/format";
import { GHOST_PILL_BUTTON_CLASS, INPUT_CLASS, PILL_BUTTON_CLASS } from "@/lib/ui-classes";
import { money } from "@/lib/format";
import {
  addDish,
  addSection,
  buildMenuDraft,
  deleteDish,
  menuSectionsOf,
  publishMenu,
  updateDish,
} from "@/mock/desk";
import { useMock } from "@/mock/MockStore";
import type { MockDish } from "@/mock/types";

type Draft = {
  sectionId: string;
  name: string;
  blurb: string;
  table: string;
  pickup: string;
  delivery: string;
  kcal: string;
  protein: string;
  carbs: string;
  fat: string;
};

const EMPTY_DRAFT = (sectionId: string): Draft => ({
  sectionId,
  name: "",
  blurb: "",
  table: "",
  pickup: "",
  delivery: "",
  kcal: "",
  protein: "",
  carbs: "",
  fat: "",
});

function centsOf(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

function pesosOf(cents: number | null): string {
  return cents === null ? "" : String(cents / 100);
}

function priceText(cents: number | null) {
  return cents === null ? "—" : money(cents);
}

function nutritionOf(d: Draft): Pick<MockDish, "kcal" | "proteinG" | "carbsG" | "fatG"> {
  const n = (raw: string) => {
    const t = raw.trim();
    if (!t) return null;
    const v = Number(t);
    return Number.isFinite(v) ? Math.round(v) : null;
  };
  return { kcal: n(d.kcal), proteinG: n(d.protein), carbsG: n(d.carbs), fatG: n(d.fat) };
}

export function MenuView() {
  const { place } = usePlaceScope();
  const { desk } = useMock();
  const router = useRouter();
  const sections = place ? menuSectionsOf(place.id, desk) : [];
  const dishes = sections.reduce((n, s) => n + s.dishes.length, 0);
  const [sectionName, setSectionName] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const columns: Column<MockDish>[] = [
    {
      key: "dish",
      head: "Dish",
      cell: (d) => (
        <button
          type="button"
          className="min-w-0 text-left"
          onClick={() => {
            if (!place) return;
            const section = sections.find((s) => s.dishes.some((x) => x.id === d.id));
            setEditing(d.id);
            setDraft({
              sectionId: section?.id ?? sections[0]?.id ?? "",
              name: d.name,
              blurb: d.blurb,
              table: pesosOf(d.table),
              pickup: pesosOf(d.pickup),
              delivery: pesosOf(d.delivery),
              kcal: d.kcal == null ? "" : String(d.kcal),
              protein: d.proteinG == null ? "" : String(d.proteinG),
              carbs: d.carbsG == null ? "" : String(d.carbsG),
              fat: d.fatG == null ? "" : String(d.fatG),
            });
          }}
        >
          <p className="text-[13px] font-semibold">{d.name}</p>
          {d.kcal != null && (
            <p className="text-muted-foreground text-[11px] tabular-nums">
              {d.kcal} kcal · P {d.proteinG ?? "—"} · C {d.carbsG ?? "—"} · F {d.fatG ?? "—"}
            </p>
          )}
          <p className="text-muted-foreground line-clamp-1 text-[11.5px] leading-snug">{d.blurb}</p>
        </button>
      ),
    },
    ...(["Table", "Pickup", "Delivery"] as const).map((label) => ({
      key: label,
      head: label,
      align: "right" as const,
      cell: (d: MockDish) => (
        <span className="tabular-nums">
          {priceText(label === "Table" ? d.table : label === "Pickup" ? d.pickup : d.delivery)}
        </span>
      ),
    })),
  ];

  const groups: TableGroup<MockDish>[] = sections.map((s) => ({
    id: s.id,
    name: s.name,
    rows: s.dishes,
  }));

  function saveDraft() {
    if (!place || !draft || !draft.name.trim()) return;
    const dish = {
      name: draft.name,
      blurb: draft.blurb.trim(),
      photoUrl: null,
      table: centsOf(draft.table),
      pickup: centsOf(draft.pickup),
      delivery: centsOf(draft.delivery),
      ...nutritionOf(draft),
    };
    if (editing) updateDish(place.id, editing, dish);
    else addDish(place.id, draft.sectionId, dish);
    setEditing(null);
    setDraft(null);
    setNotice(editing ? "Dish updated. Publish to make it public." : "Dish added. It stays a draft until you publish.");
  }

  const slug = place ? place.id.replace(/^plc_/, "") : "";

  return (
    <div className="flex flex-col gap-4">
      {place && (
        <Group title="Published" allowOneRow>
          <Rule
            label={place.menuPublishedAt ? "Published" : "Draft"}
            note={
              place.menuPublishedAt
                ? `Published ${day(place.menuPublishedAt)}. The QR, your page, Online Orders and the Answering Agent all read this version; edits below stay a draft until you publish again.`
                : "Nothing is public yet. Online Orders, the Answering Agent and the Express Website wait on this button."
            }
            badge={<Badge tone={place.menuPublishedAt ? "live" : "off"}>{place.menuPublishedAt ? "On" : "Not yet"}</Badge>}
            control={{
              kind: "button",
              label: place.menuPublishedAt ? "Publish changes" : "Publish",
              emphasis: "primary",
              disabled: dishes === 0,
              onClick: () => {
                publishMenu(place.id);
                setNotice("Published. The guest menu and the Express Website read this version.");
              },
            }}
          />
        </Group>
      )}

      {notice && (
        <p className="bg-muted text-muted-foreground rounded-lg px-3 py-2 text-xs" role="status">
          {notice}
        </p>
      )}

      <Group title="Start from the menu you already have" allowOneRow>
        <Rule
          label="A photo, a PDF or your website"
          note="Mesita reads it and writes the draft, so you approve dishes and prices instead of typing them. In this console the draft is the menu already on file."
          control={{
            kind: "button",
            label: "Build my menu",
            onClick: () => {
              if (!place) return;
              buildMenuDraft(place.id);
              setNotice("Draft is ready. Approve the dishes, then publish.");
            },
          }}
        />
      </Group>

      <Group
        title="The menu"
        description={`${sections.length} sections · ${dishes} dishes · three prices each.`}
        right={
          <button
            type="button"
            className={GHOST_PILL_BUTTON_CLASS}
            onClick={() => {
              if (!sections[0]) return;
              setEditing(null);
              setDraft(EMPTY_DRAFT(sections[0].id));
            }}
          >
            Add a dish
          </button>
        }
      >
        <div className="flex flex-wrap items-center gap-2 px-3 pt-3">
          <input
            aria-label="New section name"
            value={sectionName}
            onChange={(e) => setSectionName(e.target.value)}
            placeholder="New section"
            className={`${INPUT_CLASS} max-w-xs`}
          />
          <button
            type="button"
            className={GHOST_PILL_BUTTON_CLASS}
            onClick={() => {
              if (!place) return;
              addSection(place.id, sectionName);
              setSectionName("");
            }}
          >
            Add section
          </button>
        </div>
        <Table columns={columns} groups={groups} inCard minWidth={520} />
        {draft && place && (
          <form
            className="grid gap-2 p-3 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              saveDraft();
            }}
          >
            <p className="sm:col-span-2 text-[13px] font-semibold">{editing ? "Edit dish" : "New dish"}</p>
            {sections.length > 1 && !editing && (
              <label className="sm:col-span-2 text-xs">
                Section
                <select
                  className={`${INPUT_CLASS} mt-1`}
                  value={draft.sectionId}
                  onChange={(e) => setDraft({ ...draft, sectionId: e.target.value })}
                >
                  {sections.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="text-xs">
              Name
              <input className={`${INPUT_CLASS} mt-1`} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required />
            </label>
            <label className="text-xs">
              What is in it
              <input className={`${INPUT_CLASS} mt-1`} value={draft.blurb} onChange={(e) => setDraft({ ...draft, blurb: e.target.value })} />
            </label>
            {(["table", "pickup", "delivery"] as const).map((key) => (
              <label key={key} className="text-xs capitalize">
                {key} price (pesos, blank = not sold)
                <input
                  inputMode="decimal"
                  className={`${INPUT_CLASS} mt-1`}
                  value={draft[key]}
                  onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                />
              </label>
            ))}
            {(["kcal", "protein", "carbs", "fat"] as const).map((key) => (
              <label key={key} className="text-xs">
                {key === "kcal" ? "kcal" : `${key} (g)`}
                <input
                  inputMode="numeric"
                  className={`${INPUT_CLASS} mt-1`}
                  value={draft[key]}
                  onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                />
              </label>
            ))}
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <button type="submit" className={PILL_BUTTON_CLASS}>
                Save dish
              </button>
              {editing && (
                <button
                  type="button"
                  className={GHOST_PILL_BUTTON_CLASS}
                  onClick={() => {
                    deleteDish(place.id, editing);
                    setEditing(null);
                    setDraft(null);
                    setNotice("Dish removed from the draft.");
                  }}
                >
                  Delete
                </button>
              )}
              <button type="button" className={GHOST_PILL_BUTTON_CLASS} onClick={() => { setDraft(null); setEditing(null); }}>
                Cancel
              </button>
            </div>
          </form>
        )}
      </Group>

      <Group title="The scan" description="How a guest reaches it. No app, no account.">
        <Rule
          label="Table QR"
          note="Opens this menu in any phone camera. It answers from what you published here."
          control={{
            kind: "value",
            text: (
              <span className="inline-flex items-center gap-2">
                <QrCode className="h-4 w-4" aria-hidden />
                {place ? `mesita.ai/m/${slug}` : ""}
              </span>
            ),
          }}
        />
        <Rule
          label="Print the QR"
          note="Who else reads it: Online Orders sells from this menu and the Answering Agent quotes it on the phone."
          control={{
            kind: "button",
            label: "Print the QR",
            onClick: () => router.push(`/m/${slug}`),
          }}
        />
      </Group>
    </div>
  );
}
