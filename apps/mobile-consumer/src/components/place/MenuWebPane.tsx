import { createElement } from 'react';

import { drivePreviewUrl, type MenuKind } from '@/lib/menu-url';

// Web-export variant (Metro web preview — the sanctioned agent verification
// surface, not a product surface). react-native-web runs in React DOM, so a
// plain iframe gives the same in-app visualization the native WebView pane
// provides: the browser renders the PDF, Drive serves its /preview embed.
// The real consumer web product is apps/web-consumer with its pdf.js viewer.

export function MenuWebPane({
  kind,
  url,
  onReady,
  onError,
}: {
  kind: Exclude<MenuKind, 'image'>;
  url: string;
  /** Content is visible; page count is unknown in an iframe (always 0). */
  onReady: (pages: number) => void;
  onError: () => void;
}) {
  const src = kind === 'drive' ? (drivePreviewUrl(url) ?? url) : url;

  return createElement('iframe', {
    title: 'Menu',
    src,
    style: {
      position: 'absolute',
      inset: 0,
      width: '100%',
      height: '100%',
      border: 0,
      background: '#ffffff',
    },
    onLoad: () => onReady(0),
    onError: () => onError(),
  });
}
