import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { GRADIENTS } from '@/constants/brand';

// Approximates web `--gradient-hero` (two radial pink blobs + vertical wash).
// RN has no CSS radials — soft absolute blobs + a linear wash get close.
export function HeroBackdrop() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        colors={[...GRADIENTS.hero]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* left blob ≈ radial at 20% -10% */}
      <LinearGradient
        colors={['rgba(255, 158, 176, 0.55)', 'rgba(255, 158, 176, 0)']}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={{
          position: 'absolute',
          top: -40,
          left: -60,
          width: 320,
          height: 240,
          borderRadius: 160,
        }}
      />
      {/* right blob ≈ radial at 90% 10% */}
      <LinearGradient
        colors={['rgba(255, 143, 184, 0.5)', 'rgba(255, 143, 184, 0)']}
        start={{ x: 0.9, y: 0 }}
        end={{ x: 0.2, y: 1 }}
        style={{
          position: 'absolute',
          top: -20,
          right: -80,
          width: 280,
          height: 220,
          borderRadius: 140,
        }}
      />
    </View>
  );
}

// Soft vertical wash used on Home / Search / Me shells (web `from-background to-muted/30`).
export function ShellWash({ children }: { children: ReactNode }) {
  return (
    <View style={{ flex: 1 }}>
      <LinearGradient
        colors={[...GRADIENTS.shell]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {children}
    </View>
  );
}
