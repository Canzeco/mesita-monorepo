import { Gem } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { Switch } from '@/components/ui/Switch';
import { useMockFacts } from '@/lib/mock-class';

// The Diamond half of the emulator — Diamond or not, and nothing in
// between (MESITA-2040, MESITA-2044).
//
// IT IS A SWITCH NOW, NOT A FOUR-WAY PICKER. `ClassPreviewToggle` offered a
// button per rung because the thing it previewed was a four-value enum, and
// picking one had to clear the others. The fact is binary and shares no field
// with Instagram, so both emulators can be on at once.

export function DiamondEmulator() {
  const [mock, setMock] = useMockFacts();
  const on = mock?.diamond ?? false;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: 'rgba(235,217,219,0.9)',
        borderRadius: 16,
        padding: 12,
      }}
    >
      <View className="h-9 w-9 items-center justify-center rounded-xl bg-muted">
        <Gem color="#775254" size={18} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          className="font-bold text-foreground"
          style={{ fontSize: 14 }}
        >
          Preview Diamond
        </Text>
        <Text className="text-muted-foreground" style={{ fontSize: 12 }}>
          Demo only — makes this account Diamond
        </Text>
      </View>
      <Switch
        value={on}
        onValueChange={() => setMock({ diamond: !on })}
        accessibilityLabel="Preview Diamond"
      />
    </View>
  );
}
