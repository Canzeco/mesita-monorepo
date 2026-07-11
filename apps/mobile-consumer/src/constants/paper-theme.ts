import { MD3LightTheme, configureFonts, type MD3Theme } from 'react-native-paper';

// Mesita brand → Material 3 light theme. Values match tailwind.config.js /
// web-consumer globals (sRGB). Light-only — never dark.

const fontConfig = configureFonts({
  config: {
    fontFamily: 'Inter_400Regular',
  },
});

export const mesitaPaperTheme: MD3Theme = {
  ...MD3LightTheme,
  roundness: 8,
  fonts: {
    ...fontConfig,
    displayLarge: { ...fontConfig.displayLarge, fontFamily: 'Fraunces_600SemiBold' },
    displayMedium: {
      ...fontConfig.displayMedium,
      fontFamily: 'Fraunces_600SemiBold',
    },
    displaySmall: { ...fontConfig.displaySmall, fontFamily: 'Fraunces_600SemiBold' },
    headlineLarge: {
      ...fontConfig.headlineLarge,
      fontFamily: 'Fraunces_600SemiBold',
    },
    headlineMedium: {
      ...fontConfig.headlineMedium,
      fontFamily: 'Fraunces_600SemiBold',
    },
    headlineSmall: {
      ...fontConfig.headlineSmall,
      fontFamily: 'Fraunces_600SemiBold',
    },
    titleLarge: { ...fontConfig.titleLarge, fontFamily: 'Inter_600SemiBold' },
    titleMedium: { ...fontConfig.titleMedium, fontFamily: 'Inter_600SemiBold' },
    titleSmall: { ...fontConfig.titleSmall, fontFamily: 'Inter_600SemiBold' },
    labelLarge: { ...fontConfig.labelLarge, fontFamily: 'Inter_500Medium' },
    labelMedium: { ...fontConfig.labelMedium, fontFamily: 'Inter_500Medium' },
    labelSmall: { ...fontConfig.labelSmall, fontFamily: 'Inter_500Medium' },
    bodyLarge: { ...fontConfig.bodyLarge, fontFamily: 'Inter_400Regular' },
    bodyMedium: { ...fontConfig.bodyMedium, fontFamily: 'Inter_400Regular' },
    bodySmall: { ...fontConfig.bodySmall, fontFamily: 'Inter_400Regular' },
  },
  colors: {
    ...MD3LightTheme.colors,
    primary: '#fb2b7b',
    onPrimary: '#fffafb',
    primaryContainer: '#ffe4ef',
    onPrimaryContainer: '#260409',
    secondary: '#cf0360',
    onSecondary: '#fffafb',
    secondaryContainer: '#faeff0',
    onSecondaryContainer: '#260409',
    tertiary: '#8b6ce8',
    onTertiary: '#ffffff',
    tertiaryContainer: '#eee8ff',
    onTertiaryContainer: '#260409',
    error: '#e6000c',
    onError: '#fffafb',
    errorContainer: '#ffe8e6',
    onErrorContainer: '#410002',
    background: '#fff7f8',
    onBackground: '#260409',
    surface: '#ffffff',
    onSurface: '#260409',
    surfaceVariant: '#faeff0',
    onSurfaceVariant: '#775254',
    outline: '#ebd9db',
    outlineVariant: '#f5e7e9',
    inverseSurface: '#260409',
    inverseOnSurface: '#fff7f8',
    inversePrimary: '#ff6eb4',
    elevation: {
      ...MD3LightTheme.colors.elevation,
      level0: 'transparent',
      level1: '#ffffff',
      level2: '#fffafb',
      level3: '#fff7f8',
      level4: '#fff5f7',
      level5: '#fff2f5',
    },
    surfaceDisabled: 'rgba(38, 4, 9, 0.12)',
    onSurfaceDisabled: 'rgba(38, 4, 9, 0.38)',
    backdrop: 'rgba(38, 4, 9, 0.4)',
  },
};
