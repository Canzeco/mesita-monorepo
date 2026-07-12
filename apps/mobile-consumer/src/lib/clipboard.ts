import { Platform, Share } from 'react-native';

/** Copy text; falls back to the system share sheet when clipboard is unavailable. */
export async function copyText(text: string): Promise<'copied' | 'shared'> {
  if (
    Platform.OS === 'web' &&
    typeof navigator !== 'undefined' &&
    navigator.clipboard?.writeText
  ) {
    await navigator.clipboard.writeText(text);
    return 'copied';
  }
  await Share.share({ message: text });
  return 'shared';
}
