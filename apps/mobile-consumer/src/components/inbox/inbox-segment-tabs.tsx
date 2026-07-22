import { Pressable, Text, View } from 'react-native';

export function InboxSegmentTabs({
  active,
  onChange,
  myCount,
  globalCount,
}: {
  active: 'mine' | 'global';
  onChange: (tab: 'mine' | 'global') => void;
  myCount: number;
  globalCount: number;
}) {
  return (
    <View className="flex-row rounded-lg border border-border bg-card p-1">
      <InboxTabButton
        active={active === 'mine'}
        onPress={() => onChange('mine')}
        label="My activity"
        count={myCount}
      />
      <InboxTabButton
        active={active === 'global'}
        onPress={() => onChange('global')}
        label="Global activity"
        count={globalCount}
        dot
      />
    </View>
  );
}

function InboxTabButton({
  active,
  onPress,
  label,
  count,
  dot = false,
}: {
  active: boolean;
  onPress: () => void;
  label: string;
  count: number;
  dot?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`${label}, ${count}`}
      className={`flex-1 flex-row items-center justify-center gap-1.5 rounded-md px-2 py-2 ${
        active ? 'bg-foreground' : 'bg-transparent'
      }`}
    >
      {dot ? (
        <View
          className={`h-1.5 w-1.5 rounded-full ${
            active ? 'bg-emerald-300' : 'bg-emerald-500'
          }`}
        />
      ) : null}
      <Text
        numberOfLines={1}
        className={`text-xs font-medium ${
          active ? 'text-white' : 'text-muted-foreground'
        }`}
      >
        {label}
      </Text>
      <View
        className={`rounded-full px-1.5 py-0.5 ${
          active ? 'bg-white/20' : 'bg-border/80'
        }`}
      >
        <Text
          className={`text-[10px] font-bold ${
            active ? 'text-white' : 'text-muted-foreground'
          }`}
        >
          {count}
        </Text>
      </View>
    </Pressable>
  );
}
