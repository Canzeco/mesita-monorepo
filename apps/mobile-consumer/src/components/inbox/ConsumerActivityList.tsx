import { Sparkles } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import {
  ACTIVITY_KIND_META,
  type ConsumerActivity,
} from '@/lib/consumer-activity-data';

export function ConsumerActivityList({
  items,
  anonymisedNote = false,
}: {
  items: ConsumerActivity[];
  anonymisedNote?: boolean;
}) {
  return (
    <View style={{ gap: 8 }}>
      {items.map((a) => {
        const meta = ACTIVITY_KIND_META[a.kind];
        const Icon = meta.Icon;
        return (
          <View
            key={a.id}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: '#ebd9db',
              backgroundColor: '#ffffff',
              padding: 12,
            }}
          >
            <View
              style={{
                height: 36,
                width: 36,
                borderRadius: 12,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: meta.bg,
              }}
            >
              <Icon color={meta.color} size={16} strokeWidth={2.25} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                style={{
                  fontSize: 13,
                  lineHeight: 18,
                  color: '#260409',
                  fontFamily: 'Inter_400Regular',
                }}
              >
                {a.handle ? (
                  <Text style={{ fontFamily: 'Inter_600SemiBold' }}>
                    {a.handle}{' '}
                  </Text>
                ) : null}
                {a.verb}{' '}
                {a.place ? (
                  <Text style={{ fontFamily: 'Inter_600SemiBold' }}>
                    {a.place}
                  </Text>
                ) : null}
              </Text>
              <Text
                style={{
                  marginTop: 2,
                  fontSize: 11,
                  color: '#775254',
                  fontFamily: 'Inter_400Regular',
                }}
              >
                {a.when}
              </Text>
            </View>
          </View>
        );
      })}
      {anonymisedNote ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            paddingTop: 4,
          }}
        >
          <Sparkles color="#775254" size={12} />
          <Text
            style={{
              fontSize: 11,
              color: '#775254',
              fontFamily: 'Inter_400Regular',
            }}
          >
            Anonymised — handles, places, and amounts are shuffled.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

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
