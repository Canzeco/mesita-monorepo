import { LinearGradient } from 'expo-linear-gradient';
import { AtSign, BadgeCheck } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { COLORS, GRADIENTS } from '@/constants/brand';

export function InstagramConnectedSummary({ followers }: { followers: number }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        borderRadius: 16,
        borderWidth: 1,
        // The one affirmative moment in the Class sheet. Green went, so the
        // panel takes the OUTLINED-INK grammar ClimbCard's reached chip wears:
        // an ink hairline over a faint ink wash, next to white climb cards —
        // never the muted fill + hairline border of ClimbCard's quiet `note`
        // box, which is the thing it would otherwise collapse into.
        borderColor: COLORS.foreground,
        backgroundColor: 'rgba(23,23,23,0.05)',
        padding: 16,
      }}
    >
      <LinearGradient
        colors={[...GRADIENTS.instagram]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          width: 44,
          height: 44,
          borderRadius: 14,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <AtSign color="#fff" size={20} />
      </LinearGradient>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ fontWeight: '800' }}>
            Profile connected
          </Text>
          {/* The glyph is what carries "it worked" now; keep it ink and loud. */}
          <BadgeCheck color={COLORS.foreground} size={16} />
        </View>
        <Text style={{ color: COLORS.mutedForeground, marginTop: 4 }}>
          {followers > 0
            ? `${followers.toLocaleString('en-US')} followers · Influencer active`
            : 'Influencer active'}
        </Text>
        {/* Influencer class from reach; Story Bonus from the connected
            handle (MESITA-909) — lead with the visit upside. */}
        <Text
          style={{ color: 'rgba(93,93,93,0.8)', marginTop: 2 }}
        >
          Story Bonus unlocked — post a tagged story any visit for more off.
        </Text>
      </View>
    </View>
  );
}
