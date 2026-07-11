import { useMemo, type ReactNode } from 'react';
import { Text } from 'react-native';

import type { Place, PlacePrediction } from '@/lib/api/places';
import type { AddState } from '@/components/memo/types';

type Segment =
  | { kind: 'text'; value: string }
  | { kind: 'place'; value: string; prediction: PlacePrediction };

type Linkified = { segments: Segment[]; unlinked: PlacePrediction[] };

function linkify(text: string, predictions: PlacePrediction[]): Linkified {
  const lower = text.toLowerCase();
  const taken: { start: number; end: number; prediction: PlacePrediction }[] =
    [];
  const unlinked: PlacePrediction[] = [];

  const byLength = [...predictions].sort(
    (a, b) => (b.mainText?.length ?? 0) - (a.mainText?.length ?? 0),
  );

  for (const prediction of byLength) {
    const name = prediction.mainText?.trim();
    if (!name) continue;
    const needle = name.toLowerCase();
    let from = 0;
    let placed = false;
    for (;;) {
      const idx = lower.indexOf(needle, from);
      if (idx === -1) break;
      const end = idx + needle.length;
      const overlaps = taken.some((r) => idx < r.end && end > r.start);
      if (!overlaps) {
        taken.push({ start: idx, end, prediction });
        placed = true;
        break;
      }
      from = idx + 1;
    }
    if (!placed) unlinked.push(prediction);
  }

  taken.sort((a, b) => a.start - b.start);

  const segments: Segment[] = [];
  let cursor = 0;
  for (const range of taken) {
    if (range.start > cursor) {
      segments.push({ kind: 'text', value: text.slice(cursor, range.start) });
    }
    segments.push({
      kind: 'place',
      value: text.slice(range.start, range.end),
      prediction: range.prediction,
    });
    cursor = range.end;
  }
  if (cursor < text.length) {
    segments.push({ kind: 'text', value: text.slice(cursor) });
  }

  return { segments, unlinked };
}

export function MemoAnswerText({
  text,
  predictions,
  resolvePlace,
  addStates,
  onInfo,
  onAdd,
}: {
  text: string;
  predictions: PlacePrediction[];
  resolvePlace: (prediction: PlacePrediction) => Place | null;
  addStates: Record<string, AddState>;
  onInfo: (prediction: PlacePrediction) => void;
  onAdd: (prediction: PlacePrediction) => void;
}) {
  const { segments, unlinked } = useMemo(
    () => linkify(text, predictions),
    [text, predictions],
  );

  const open = (prediction: PlacePrediction) => {
    const onMesita =
      Boolean(prediction.mesitaSlug ?? prediction.mesitaId) ||
      Boolean(resolvePlace(prediction));
    if (onMesita) onInfo(prediction);
    else onAdd(prediction);
  };

  const PlaceLink = ({
    prediction,
    children,
  }: {
    prediction: PlacePrediction;
    children: ReactNode;
  }) => {
    const adding = addStates[prediction.placeId] === 'adding';
    return (
      <Text
        onPress={() => open(prediction)}
        className={`font-medium text-foreground underline ${adding ? 'opacity-60' : ''}`}
        style={{ textDecorationColor: 'rgba(251,43,123,0.5)' }}
      >
        {children}
      </Text>
    );
  };

  return (
    <Text className="text-sm leading-relaxed text-foreground">
      {segments.map((seg, i) =>
        seg.kind === 'text' ? (
          <Text key={i}>{seg.value}</Text>
        ) : (
          <PlaceLink key={i} prediction={seg.prediction}>
            {seg.value}
          </PlaceLink>
        ),
      )}
      {unlinked.length > 0 ? (
        <Text className="mt-1 text-[13px] text-muted-foreground">
          {'\n'}También:{' '}
          {unlinked.map((prediction, i) => (
            <Text key={prediction.placeId}>
              {i > 0 ? ', ' : ''}
              <PlaceLink prediction={prediction}>{prediction.mainText}</PlaceLink>
            </Text>
          ))}
        </Text>
      ) : null}
    </Text>
  );
}
