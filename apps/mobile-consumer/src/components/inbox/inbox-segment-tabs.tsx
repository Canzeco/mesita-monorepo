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
    <View
      style={{
        flexDirection: 'row',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#ebd9db',
        backgroundColor: '#ffffff',
        padding: 4,
      }}
    >
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
      style={{
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        borderRadius: 6,
        paddingHorizontal: 8,
        paddingVertical: 8,
        backgroundColor: active ? '#260409' : 'transparent',
      }}
    >
      {dot ? (
        <View
          style={{
            height: 6,
            width: 6,
            borderRadius: 999,
            backgroundColor: active ? '#6ee7b7' : '#10b981',
          }}
        />
      ) : null}
      <Text
        numberOfLines={1}
        style={{
          fontSize: 12,
          fontFamily: 'Inter_500Medium',
          color: active ? '#ffffff' : '#775254',
        }}
      >
        {label}
      </Text>
      <View
        style={{
          borderRadius: 999,
          paddingHorizontal: 6,
          paddingVertical: 2,
          backgroundColor: active
            ? 'rgba(255,255,255,0.20)'
            : 'rgba(235,217,219,0.8)',
        }}
      >
        <Text
          style={{
            fontSize: 10,
            fontFamily: 'Inter_700Bold',
            color: active ? '#ffffff' : '#775254',
          }}
        >
          {count}
        </Text>
      </View>
    </Pressable>
  );
}
