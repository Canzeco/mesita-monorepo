import { AtSign, Gem } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { Switch } from '@/components/ui/Switch';
import { GRADIENT_DIAGONAL, GRADIENTS } from '@/constants/brand';
import { useMockFacts } from '@/lib/mock-class';

// Demo-only emulation controls while the two facts cannot be produced with
// real data. Mirrors web's DemoBox pair.
//
// TWO SWITCHES, NOT A CLASS PICKER (MESITA-2040). The second row used to
// emulate Mesita Premium, because under the ladder a subscription was a CLASS
// and so belonged beside Instagram. Paying grants no fact on this surface; the
// facts are Instagram and Diamond, and both can be on at once because they no
// longer compete for one slot.

export function MockControls() {
  const [mock, setMock] = useMockFacts();
  const igOn = mock?.instagram ?? false;
  const diamondOn = mock?.diamond ?? false;
  const override = mock != null;

  return (
    <View
      style={{
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: 'rgba(235,217,219,0.9)',
        borderRadius: 16,
        padding: 12,
        gap: 8,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Text
          style={{
            backgroundColor: 'rgba(245,158,11,0.15)',
            color: '#d97706',
            paddingHorizontal: 6,
            paddingVertical: 2,
            borderRadius: 4,
            overflow: 'hidden',
            fontWeight: '800',
            letterSpacing: 1.2,
            fontSize: 11,
          }}
        >
          DEMO
        </Text>
        <Text
          style={{ color: '#775254', flex: 1, fontWeight: '600', fontSize: 12 }}
        >
          Emulate account states
        </Text>
        {override ? (
          <Pressable
            onPress={() => setMock(null)}
            accessibilityRole="button"
            accessibilityLabel="Reset the demo account"
            hitSlop={8}
          >
            <Text
              style={{
                color: '#775254',
                fontWeight: '700',
                textDecorationLine: 'underline',
                fontSize: 12,
              }}
            >
              Reset
            </Text>
          </Pressable>
        ) : null}
      </View>

      <EmulateRow
        ig
        title="Emulate Instagram"
        summary="Preview a connected account over the bar"
        on={igOn}
        onToggle={() => setMock({ instagram: !igOn })}
      />
      <EmulateRow
        title="Emulate Diamond"
        summary="Preview an invitation"
        on={diamondOn}
        onToggle={() => setMock({ diamond: !diamondOn })}
      />
    </View>
  );
}

function EmulateRow({
  ig,
  title,
  summary,
  on,
  onToggle,
}: {
  ig?: boolean;
  title: string;
  summary: string;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <View
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
      {ig ? (
        <LinearGradient
          colors={[...GRADIENTS.instagram]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <AtSign color="#fff" size={18} />
        </LinearGradient>
      ) : (
        <LinearGradient
          colors={[...GRADIENTS.pink]}
          start={GRADIENT_DIAGONAL.start}
          end={GRADIENT_DIAGONAL.end}
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Gem color="#fff" size={18} />
        </LinearGradient>
      )}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontWeight: '700', fontSize: 15, color: '#260409' }}>
          {title}
        </Text>
        <Text
          style={{ color: '#775254', fontSize: 12 }}
          numberOfLines={1}
        >
          {summary}
        </Text>
      </View>
      <Switch
        value={on}
        onValueChange={onToggle}
        accessibilityLabel={title}
      />
    </View>
  );
}
