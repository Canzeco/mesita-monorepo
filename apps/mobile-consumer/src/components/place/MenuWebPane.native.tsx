import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

import { drivePreviewUrl, type MenuKind } from '@/lib/menu-url';

// In-app menu visualization for PDF and Google Drive menus — web MenuViewer
// parity (MESITA-564 look/feature parity):
//  · Drive → Google's official /preview embed inside a WebView.
//  · PDF → pdf.js inside a WebView HTML shell rendering every page into a
//    canvas card (white rounded pages, floating "2 / 14" chip), because
//    neither iOS nor Android WebViews can display remote PDFs natively.
// The pdf.js runtime loads from jsDelivr pinned to the exact version the web
// apps bundle; the PDF itself already needs the network, so the CDN adds no
// new offline failure mode.

const PDFJS_VERSION = '6.2.108';

function pdfShellHtml(url: string): string {
  const src = JSON.stringify(url);
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=4, user-scalable=yes" />
<style>
  html, body { margin: 0; padding: 0; background: #f8eff0; }
  #pages { padding: 12px 12px 40px; }
  canvas.page {
    display: block;
    width: 100%;
    height: auto;
    margin: 0 auto 12px;
    background: #ffffff;
    border-radius: 12px;
    box-shadow: 0 4px 14px rgba(38, 4, 9, 0.12);
  }
  #chip {
    position: fixed;
    bottom: 12px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(38, 4, 9, 0.8);
    color: #fffaf8;
    font: 600 11px -apple-system, system-ui, sans-serif;
    font-variant-numeric: tabular-nums;
    padding: 5px 12px;
    border-radius: 999px;
    box-shadow: 0 2px 8px rgba(38, 4, 9, 0.2);
  }
</style>
</head>
<body>
<div id="pages"></div>
<div id="chip" hidden></div>
<script type="module">
  const post = (m) => window.ReactNativeWebView?.postMessage(JSON.stringify(m));
  try {
    const pdfjs = await import(
      'https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.min.mjs'
    );
    pdfjs.GlobalWorkerOptions.workerSrc =
      'https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.mjs';
    const doc = await pdfjs.getDocument({ url: ${src} }).promise;
    const container = document.getElementById('pages');
    const chip = document.getElementById('chip');
    const total = doc.numPages;
    // Backing-store width with DPR headroom so pinch-zoomed pages stay crisp.
    const width = Math.min(
      2048,
      Math.round((innerWidth - 24) * Math.min(devicePixelRatio || 1, 2) * 1.5),
    );

    const canvases = [];
    for (let i = 1; i <= total; i++) {
      const page = await doc.getPage(i);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: width / base.width });
      const canvas = document.createElement('canvas');
      canvas.className = 'page';
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      container.appendChild(canvas);
      canvases.push(canvas);
      await page.render({ canvas, viewport }).promise;
    }
    // Ready only after every page is painted — posting earlier let late
    // render failures flip the sheet to the external-open fallback even
    // after pages were already visible.
    post({ type: 'ready', pages: total });

    if (total > 1) {
      chip.hidden = false;
      const update = () => {
        const mid = scrollY + innerHeight / 2;
        let best = 1;
        let bestDist = Infinity;
        canvases.forEach((el, i) => {
          const r = el.getBoundingClientRect();
          const center = scrollY + r.top + r.height / 2;
          const dist = Math.abs(center - mid);
          if (dist < bestDist) { bestDist = dist; best = i + 1; }
        });
        chip.textContent = best + ' / ' + total;
      };
      update();
      addEventListener('scroll', update, { passive: true });
    }
  } catch (e) {
    post({ type: 'error' });
  }
</script>
</body>
</html>`;
}

export function MenuWebPane({
  kind,
  url,
  onReady,
  onError,
}: {
  kind: Exclude<MenuKind, 'image'>;
  url: string;
  /** Content is visible; PDF variant reports the page count (Drive: 0). */
  onReady: (pages: number) => void;
  onError: () => void;
}) {
  // The WebView only reloads when `source` changes (html memoized by url) —
  // handler identity churn from parent re-renders is harmless.
  const html = useMemo(
    () => (kind === 'pdf' ? pdfShellHtml(url) : null),
    [kind, url],
  );

  if (kind === 'drive') {
    return (
      <WebView
        source={{ uri: drivePreviewUrl(url) ?? url }}
        style={styles.pane}
        onLoad={() => onReady(0)}
        onError={() => onError()}
        onHttpError={() => onError()}
        allowsInlineMediaPlayback
      />
    );
  }

  return (
    <WebView
      originWhitelist={['*']}
      source={{ html: html ?? '' }}
      style={styles.pane}
      onMessage={(e) => {
        try {
          const msg = JSON.parse(e.nativeEvent.data) as {
            type?: string;
            pages?: number;
          };
          if (msg.type === 'ready') {
            onReady(typeof msg.pages === 'number' ? msg.pages : 0);
          } else if (msg.type === 'error') {
            onError();
          }
        } catch {
          // Non-JSON message — ignore.
        }
      }}
      onError={() => onError()}
    />
  );
}

const styles = StyleSheet.create({
  // Transparent so the sheet's muted backdrop shows until content paints.
  pane: { flex: 1, backgroundColor: 'transparent' },
});
