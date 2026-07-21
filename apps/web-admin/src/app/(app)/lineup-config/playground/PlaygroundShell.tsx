"use client";

import { useMemo, useState } from "react";
import { CalendarClock, MapPin, MessageSquareText, Store, Tags, UserRound } from "lucide-react";
import { composeIntent, WEEKDAYS, type IntentSpec } from "@/lib/business/cip";
import { useScoring } from "../ScoringProvider";
import { GroupHead } from "../panel-ui";
import { SpecimenCell, type PlaygroundSpecimen } from "../playground-ui";
import { SubscorePlayground } from "../subscores/SubscorePlayground";
import { DeckPlayground } from "../lanes/DeckPlayground";

// Playground — both simulators under ONE shared specimen bar (decision D3),
// and the intent is AUTHORED, not sampled: Consumer and Place are fixed
// selects over real DB rows; the intent is composed by the operator along
// its real axes — Where (zone / point) · When (day + hour) · What (category)
// · That (the free-text ask, EM's query). XX draws are pinned to one seeded
// roll (no re-roll — Pato 2026-07-21). Both sections read the CURRENT form
// values from the shared provider — nothing on this page writes config.

const HOUR_OPTIONS = Array.from({ length: 48 }, (_, i) => i / 2);

function fmtHour(h: number): string {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export function PlaygroundShell() {
  const { consumers, places } = useScoring();

  const [consumerIdx, setConsumerIdx] = useState(0);
  const [placeIdx, setPlaceIdx] = useState(0);

  // The intent spec — the operator's four axes.
  const [ask, setAsk] = useState("");
  const [zoneName, setZoneName] = useState<string | null>(null);
  const [day, setDay] = useState<string>("friday");
  const [hour, setHour] = useState(20.5);
  const [catAsk, setCatAsk] = useState<string | null>(null);

  const zones = useMemo(
    () => [...new Set(places.map((p) => p.zone).filter((z): z is string => !!z))].sort(),
    [places],
  );
  const categories = useMemo(
    () => [...new Set(places.map((p) => p.category).filter((c): c is string => !!c))].sort(),
    [places],
  );

  const intent = useMemo(() => {
    const spec: IntentSpec = { ask, zoneName, day, hour, cats: catAsk ? [catAsk] : [] };
    return composeIntent(spec, places);
  }, [ask, zoneName, day, hour, catAsk, places]);

  const specimen: PlaygroundSpecimen = { consumerIdx, placeIdx, intent };

  // Width-free base — the When row sizes its two selects itself; everything
  // else appends w-full (appending a width to a w-full class loses: Tailwind's
  // cascade order decides, not class-string order).
  const selectBase =
    "border-border/70 bg-card rounded-lg border px-2 py-1.5 text-[12px] font-medium";
  const selectCls = selectBase + " w-full";

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      {/* Fixed specimens — real DB rows */}
      <div className="grid gap-2.5 sm:grid-cols-2">
        <SpecimenCell icon={UserRound} tone="bg-violet-600 text-white" label="Consumer">
          <select
            aria-label="Consumer"
            className={selectCls}
            value={consumerIdx}
            onChange={(e) => setConsumerIdx(Number(e.target.value))}
          >
            {consumers.length === 0 ? <option value={0}>no consumers — synthetic</option> : null}
            {consumers.map((c, i) => (
              <option key={c.id} value={i}>
                {c.label ?? c.id.slice(0, 8)} · {c.class_key}
              </option>
            ))}
          </select>
        </SpecimenCell>
        <SpecimenCell icon={Store} tone="bg-emerald-600 text-white" label="Place · n = 1 only">
          <select
            aria-label="Place (n = 1 section only)"
            className={selectCls}
            value={placeIdx}
            onChange={(e) => setPlaceIdx(Number(e.target.value))}
          >
            {places.length === 0 ? <option value={0}>no places yet</option> : null}
            {places.map((p, i) => (
              <option key={p.id} value={i}>
                {p.name}
              </option>
            ))}
          </select>
        </SpecimenCell>
      </div>

      {/* Custom intent — the operator authors the query side */}
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        <SpecimenCell icon={MapPin} tone="bg-sky-600 text-white" label="Where">
          <select
            aria-label="Where — named zone or point mode"
            className={selectCls}
            value={zoneName ?? ""}
            onChange={(e) => setZoneName(e.target.value || null)}
          >
            <option value="">point (GPS) — near the sample anchor</option>
            {zones.map((z) => (
              <option key={z} value={z}>
                zone · {z}
              </option>
            ))}
          </select>
        </SpecimenCell>
        <SpecimenCell icon={CalendarClock} tone="bg-rose-600 text-white" label="When">
          <div className="flex items-center gap-1.5">
            <select
              aria-label="Day of week"
              className={selectBase + " min-w-0 flex-1 capitalize"}
              value={day}
              onChange={(e) => setDay(e.target.value)}
            >
              {WEEKDAYS.map((d) => (
                <option key={d} value={d} className="capitalize">
                  {d}
                </option>
              ))}
            </select>
            <select
              aria-label="Hour"
              className={selectBase + " w-[5.5rem] shrink-0"}
              value={hour}
              onChange={(e) => setHour(Number(e.target.value))}
            >
              {HOUR_OPTIONS.map((h) => (
                <option key={h} value={h}>
                  {fmtHour(h)}
                </option>
              ))}
            </select>
          </div>
        </SpecimenCell>
        <SpecimenCell icon={Tags} tone="bg-indigo-600 text-white" label="What">
          <select
            aria-label="What — category ask"
            className={selectCls}
            value={catAsk ?? ""}
            onChange={(e) => setCatAsk(e.target.value || null)}
          >
            <option value="">nothing asked — what → 1</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </SpecimenCell>
        <SpecimenCell icon={MessageSquareText} tone="bg-slate-600 text-white" label="That · the ask">
          <input
            type="text"
            aria-label="That — the free-text ask (EM's query)"
            className={selectCls}
            placeholder='"mezcal cocktails for a first date"'
            value={ask}
            onChange={(e) => setAsk(e.target.value)}
          />
        </SpecimenCell>
      </div>

      <SubscorePlayground specimen={specimen} />

      <GroupHead>Same specimen, whole pool — the full Lineup run below.</GroupHead>

      <DeckPlayground specimen={specimen} />
    </div>
  );
}
