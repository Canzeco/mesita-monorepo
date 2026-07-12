import { ChevronDown } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

const LONG_TEXT_THRESHOLD = 600;

function formatAboutDisplay(text: string): string {
  const normalized = text.replace(/\r\n/g, '\n').trim();
  const blankSplit = normalized
    .split(/\n\s*\n+/)
    .map((p) => p.replace(/\n+/g, ' ').replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean);
  if (blankSplit.length > 1) return blankSplit.join('\n\n');
  const soft = normalized
    .split(/\n+/)
    .map((p) => p.replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean);
  return soft.length > 1 ? soft.join('\n\n') : normalized;
}

export function AboutBox({ text, name }: { text: string; name: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > LONG_TEXT_THRESHOLD;
  const heading = `About ${name}`;
  const body = formatAboutDisplay(text);

  if (!text.trim()) return null;

  const content = (
    <>
      <Text className="text-[10px] font-bold tracking-[0.18em] text-muted-foreground uppercase">
        {heading}
      </Text>
      <Text
        className="text-base leading-relaxed text-muted-foreground"
        numberOfLines={isLong && !expanded ? 10 : undefined}
      >
        {body}
      </Text>
      {isLong ? (
        <View className="flex-row items-center gap-1">
          <Text className="text-[11px] font-semibold text-foreground">
            {expanded ? 'Show less' : 'Show more'}
          </Text>
          <ChevronDown
            color="#260409"
            size={12}
            style={{
              transform: [{ rotate: expanded ? '180deg' : '0deg' }],
            }}
          />
        </View>
      ) : null}
    </>
  );

  if (!isLong) {
    return (
      <View className="gap-3 rounded-2xl border border-border bg-card p-4">
        {content}
      </View>
    );
  }

  return (
    <Pressable
      onPress={() => setExpanded((e) => !e)}
      className="gap-3 rounded-2xl border border-border bg-card p-4 active:opacity-90"
    >
      {content}
    </Pressable>
  );
}
