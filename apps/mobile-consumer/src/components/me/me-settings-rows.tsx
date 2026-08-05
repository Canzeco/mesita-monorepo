import { Settings as SettingsIcon, Share2 } from 'lucide-react-native';
import { Alert, Text, View } from 'react-native';

import { BoxRow } from '@/components/ui/BoxRow';
import { Switch } from '@/components/ui/Switch';

export function SectionLabel({ children }: { children: string }) {
  return (
    <Text
      className="mt-1 font-semibold uppercase text-muted-foreground"
      style={{ fontSize: 11, letterSpacing: 0.8 }}
    >
      {children}
    </Text>
  );
}

export function PrefRow({
  title,
  summary,
  value,
  onValueChange,
  disabled,
}: {
  title: string;
  summary: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View
      className="mb-2 flex-row items-center gap-3 rounded-2xl border border-border bg-card p-4"
      style={disabled ? { opacity: 0.6 } : undefined}
    >
      <View className="min-w-0 flex-1">
        <Text className="font-bold text-foreground" style={{ fontSize: 15 }}>
          {title}
        </Text>
        <Text
          className="text-muted-foreground"
          style={{ fontSize: 12, lineHeight: 16 }}
        >
          {summary}
        </Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        accessibilityLabel={title}
      />
    </View>
  );
}

export function SelectRow({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (next: string) => void;
}) {
  const current = options.find((o) => o.value === value)?.label ?? value;
  return (
    <BoxRow
      Icon={SettingsIcon}
      tint="muted"
      title={label}
      summary={current}
      onPress={() => {
        Alert.alert(label, undefined, [
          ...options.map((o) => ({
            text: o.label,
            onPress: () => onChange(o.value),
          })),
          { text: 'Cancel', style: 'cancel' as const },
        ]);
      }}
    />
  );
}

export function LinkRow({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <BoxRow
      Icon={Share2}
      tint="muted"
      title={title}
      summary="Opens in browser"
      onPress={onPress}
    />
  );
}
