/**
 * Screenshot capture on top of 3DHOP's `saveScreenshot()`: the presenter writes a PNG data URL to
 * `screenshotData` at the end of its next draw (and, unless `config.autoSaveScreenshot` is false,
 * downloads it itself). These helpers wait for that frame and turn the result into something
 * useful (blob for the clipboard, custom file name, callback).
 */
import type { PresenterInstance } from './types.js';

export type CaptureOptions = {
  /** Max time to wait for the presenter to finish the capture frame (ms). */
  timeoutMs?: number;
  /** Polling interval (ms); a frame normally lands within one or two. */
  pollMs?: number;
};

/**
 * Triggers a capture and resolves with the PNG data URL (`data:image/png;base64,…`). 3DHOP
 * stores it with an `image/octet-stream` MIME to force a download; this normalises it back.
 * `autoSaveScreenshot` is turned off for the duration so 3DHOP doesn't also download the file.
 */
export function captureScreenshot(presenter: PresenterInstance, { timeoutMs = 2000, pollMs = 16 }: CaptureOptions = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    if (typeof presenter.saveScreenshot !== 'function') {
      reject(new Error('Presenter does not support saveScreenshot'));
      return;
    }
    const scene = presenter._scene as { config?: { autoSaveScreenshot?: boolean } } | undefined;
    const previousAuto = scene?.config?.autoSaveScreenshot;
    if (scene?.config) scene.config.autoSaveScreenshot = false;

    const restore = () => {
      if (scene?.config) scene.config.autoSaveScreenshot = previousAuto;
    };

    presenter.screenshotData = null;
    presenter.saveScreenshot();

    const started = Date.now();
    const poll = () => {
      const data = presenter.screenshotData;
      if (!presenter.isCapturingScreenshot && typeof data === 'string' && data.length > 0) {
        restore();
        resolve(normalisePngDataUrl(data));
        return;
      }
      if (Date.now() - started > timeoutMs) {
        restore();
        reject(new Error('Timed out waiting for the screenshot frame'));
        return;
      }
      setTimeout(poll, pollMs);
    };
    setTimeout(poll, pollMs);
  });
}

export function normalisePngDataUrl(dataUrl: string): string {
  return dataUrl.replace(/^data:image\/octet-stream/, 'data:image/png');
}

/** Decodes a data URL into a Blob without going through `fetch` (works offline and in tests). */
export function dataUrlToBlob(dataUrl: string): Blob {
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(dataUrl);
  if (!match) throw new Error('Not a data URL');
  const mime = match[1] || 'application/octet-stream';
  const isBase64 = Boolean(match[2]);
  const payload = match[3];
  if (!isBase64) {
    return new Blob([decodeURIComponent(payload)], { type: mime });
  }
  const binary = atob(payload);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/** Copies a PNG data URL to the clipboard as an image. Rejects when the API is unavailable. */
export async function copyImageToClipboard(dataUrl: string): Promise<void> {
  const clipboard = typeof navigator === 'undefined' ? undefined : navigator.clipboard;
  const ClipboardItemCtor = typeof ClipboardItem === 'undefined' ? undefined : ClipboardItem;
  if (!clipboard || typeof clipboard.write !== 'function' || !ClipboardItemCtor) {
    throw new Error('Clipboard image writing is not supported in this browser');
  }
  const blob = dataUrlToBlob(normalisePngDataUrl(dataUrl));
  await clipboard.write([new ClipboardItemCtor({ 'image/png': blob })]);
}

/** Builds the file name 3DHOP would use: `<base>[_HHMMSS].png`. */
export function screenshotFileName(baseName = 'screenshot', withTime = true, now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = withTime ? `_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}` : '';
  return `${baseName}${stamp}.png`;
}

/** Triggers a browser download of a data URL. */
export function downloadDataUrl(dataUrl: string, fileName: string): void {
  if (typeof document === 'undefined') return;
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = fileName;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
