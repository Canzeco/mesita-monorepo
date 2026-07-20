import { View } from 'react-native';

function Bone({ style }: { style?: object }) {
  return (
    <View
      style={[
        { borderRadius: 12, backgroundColor: 'rgba(235,217,219,0.45)' },
        style,
      ]}
    />
  );
}

/** Ticket details loading — web TicketDetailsSkeleton peer. */
export function TicketDetailsSkeleton() {
  return (
    <View style={{ width: '100%', gap: 16 }}>
      <View
        style={{
          overflow: 'hidden',
          borderRadius: 16,
          borderWidth: 1,
          borderColor: 'rgba(207,3,96,0.15)',
          backgroundColor: '#ffffff',
        }}
      >
        <View style={{ padding: 16, gap: 12 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Bone style={{ width: 88, height: 88, borderRadius: 16 }} />
            <View style={{ flex: 1, height: 88, justifyContent: 'space-between' }}>
              <Bone style={{ height: 26, borderRadius: 12 }} />
              <Bone style={{ height: 26, borderRadius: 12 }} />
              <Bone style={{ height: 26, borderRadius: 12 }} />
            </View>
          </View>
          <Bone style={{ height: 64, borderRadius: 16 }} />
          <Bone style={{ height: 56, borderRadius: 16 }} />
        </View>
      </View>
      <View
        style={{
          gap: 12,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: '#ebd9db',
          backgroundColor: '#ffffff',
          padding: 16,
        }}
      >
        <Bone style={{ height: 32, width: 96, borderRadius: 999 }} />
        <Bone style={{ height: 80, borderRadius: 16 }} />
        <Bone style={{ height: 48, borderRadius: 999 }} />
      </View>
    </View>
  );
}
