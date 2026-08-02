// The paid beat (MESITA-808, 4A) — mobile mirror. Savings count-up when a
// watched ticket flips to revealed, then the ticket settles into History.
// One of exactly two motions on the Rewards page.

import { PartyPopper } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { GRADIENT_DIAGONAL, GRADIENTS } from '@/constants/brand';
import { formatCurrency } from '@/lib/api/pay';

const REVEAL_MS = 900;

export function SavingsReveal({
  placeName,
  savedCents,
  onDone,
}: {
  placeName: string;
  savedCents: number;
  onDone: () => void;
}) {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    let raf = 0;
    const start = Date.now();
    const tick = () => {
      if (savedCents <= 0) {
        setShown(0);
        return;
      }
      const t = Math.min(1, (Date.now() - start) / REVEAL_MS);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(savedCents * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [savedCents]);

  useEffect(() => {
    const t = setTimeout(onDone, 4200);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <LinearGradient
      colors={[...GRADIENTS.pink]}
      start={GRADIENT_DIAGONAL.start}
      end={GRADIENT_DIAGONAL.end}
      style={{
        borderRadius: 24,
        paddingHorizontal: 20,
        paddingVertical: 28,
        alignItems: 'center',
        gap: 8,
      }}
    >
      <View className="h-11 w-11 items-center justify-center rounded-full bg-white/20">
        <PartyPopper size={20} color="#fff" />
      </View>
      <Text
        className="font-bold uppercase text-white/85"
        style={{ fontSize: 11, letterSpacing: 1.4 }}
      >
        Visit complete at {placeName}
      </Text>
      <Text
        className="font-display font-bold text-white"
        style={{ fontSize: 38, fontVariant: ['tabular-nums'] }}
      >
        {savedCents > 0 ? formatCurrency(shown) : '¡Listo!'}
      </Text>
      <Text className="text-white/90" style={{ fontSize: 12 }}>
        {savedCents > 0 ? 'saved on this visit' : 'ticket closed'}
      </Text>
    </LinearGradient>
  );
}
