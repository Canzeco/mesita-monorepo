import { Text, View } from 'react-native';

export function CarouselPillDots({
  count,
  activeIdx,
}: {
  count: number;
  activeIdx: number;
}) {
  return (
    <View
      pointerEvents="none"
      className="absolute inset-x-0 top-3 z-10 flex-row justify-center gap-1.5"
    >
      {Array.from({ length: count }, (_, i) => (
        <View
          key={i}
          className={`h-1.5 rounded-full bg-white ${
            i === activeIdx ? 'w-5 opacity-100' : 'w-1.5 opacity-60'
          }`}
          style={{
            shadowColor: '#000',
            shadowOpacity: 0.55,
            shadowRadius: 3,
          }}
        />
      ))}
    </View>
  );
}

export function CarouselSlideCounter({
  idx,
  count,
}: {
  idx: number;
  count: number;
}) {
  return (
    <View
      pointerEvents="none"
      className="absolute top-3 right-3 z-10 rounded-full bg-black/60 px-2 py-0.5"
    >
      <Text className="text-[10px] font-semibold text-white">
        {idx + 1} / {count}
      </Text>
    </View>
  );
}
