// @vitest-environment jsdom
import React from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ScreenshotControl, Toolbar, ToolbarAssetsProvider } from '../src/Toolbar.js';
import {
  captureScreenshot,
  copyImageToClipboard,
  dataUrlToBlob,
  normalisePngDataUrl,
  screenshotFileName
} from '../src/viewer/screenshot.js';
import { createMockPresenter, type MockPresenter } from './mockPresenter.js';
import { ViewerHarness, type HarnessControls } from './harness.js';

// A 1×1 transparent PNG.
const PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const HOP_DATA_URL = `data:image/octet-stream;base64,${PNG_B64}`;

/** Make the mock presenter behave like 3DHOP: saveScreenshot() sets the flag, "next frame" writes the data. */
function withScreenshot(presenter: MockPresenter) {
  presenter.saveScreenshot = vi.fn(function (this: MockPresenter) {
    this.isCapturingScreenshot = true;
    setTimeout(() => {
      this.isCapturingScreenshot = false;
      this.screenshotData = HOP_DATA_URL;
    }, 0);
  }.bind(presenter));
  return presenter;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('screenshot helpers', () => {
  it('normalises 3DHOP\'s octet-stream MIME back to PNG', () => {
    expect(normalisePngDataUrl(HOP_DATA_URL)).toBe(`data:image/png;base64,${PNG_B64}`);
  });

  it('decodes a data URL into a typed Blob', async () => {
    const blob = dataUrlToBlob(normalisePngDataUrl(HOP_DATA_URL));
    expect(blob.type).toBe('image/png');
    expect(blob.size).toBe(atob(PNG_B64).length);
  });

  it('builds 3DHOP-style file names', () => {
    const at = new Date(2026, 0, 1, 9, 5, 7);
    expect(screenshotFileName('gargo', true, at)).toBe('gargo_090507.png');
    expect(screenshotFileName('gargo', false, at)).toBe('gargo.png');
    expect(screenshotFileName(undefined, false, at)).toBe('screenshot.png');
  });

  it('captureScreenshot waits for the frame, restores autoSave, and returns a PNG URL', async () => {
    const presenter = withScreenshot(createMockPresenter({ config: { autoSaveScreenshot: true } }));
    const pending = captureScreenshot(presenter, { pollMs: 1 });
    expect(presenter._scene.config.autoSaveScreenshot).toBe(false);
    await expect(pending).resolves.toBe(`data:image/png;base64,${PNG_B64}`);
    expect(presenter._scene.config.autoSaveScreenshot).toBe(true);
  });

  it('captureScreenshot times out if no frame arrives', async () => {
    const presenter = createMockPresenter();
    presenter.saveScreenshot = vi.fn();
    await expect(captureScreenshot(presenter, { pollMs: 1, timeoutMs: 10 })).rejects.toThrow(/Timed out/);
  });

  it('copyImageToClipboard writes a PNG ClipboardItem', async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('ClipboardItem', class {
      constructor(public items: Record<string, Blob>) {}
    });
    Object.defineProperty(navigator, 'clipboard', { value: { write }, configurable: true });

    await copyImageToClipboard(HOP_DATA_URL);
    expect(write).toHaveBeenCalledTimes(1);
    const item = write.mock.calls[0][0][0] as { items: Record<string, Blob> };
    expect(item.items['image/png'].type).toBe('image/png');
  });

  it('copyImageToClipboard rejects when unsupported', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    await expect(copyImageToClipboard(HOP_DATA_URL)).rejects.toThrow(/not supported/);
  });
});

describe('ScreenshotControl', () => {
  function mount(presenter: MockPresenter, ui: React.ReactNode) {
    const controls: React.MutableRefObject<HarnessControls | null> = { current: null };
    const utils = render(
      <ViewerHarness presenter={presenter} controlsRef={controls}>
        <ToolbarAssetsProvider assetBaseUrl="/3dhop">
          <div data-hop-toolbar-container="true">
            <Toolbar>{ui}</Toolbar>
          </div>
        </ToolbarAssetsProvider>
      </ViewerHarness>
    );
    return { controls: () => controls.current!, ...utils };
  }

  it('leaves the default capture to 3DHOP when no extra props are set', () => {
    const presenter = withScreenshot(createMockPresenter());
    const { controls, container } = mount(presenter, <ScreenshotControl />);
    expect(container.querySelector('[data-hop-id="screenshot"]')).not.toBeNull();
    expect(controls().toolbarAction('screenshot')).toBe(false);
    expect(presenter.saveScreenshot).not.toHaveBeenCalled();
  });

  it('takes over: calls onScreenshot, downloads with a custom name, and copies to the clipboard', async () => {
    const presenter = withScreenshot(createMockPresenter({ config: { autoSaveScreenshot: true } }));
    const onScreenshot = vi.fn();
    const write = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('ClipboardItem', class {
      constructor(public items: Record<string, Blob>) {}
    });
    Object.defineProperty(navigator, 'clipboard', { value: { write }, configurable: true });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    const { controls } = mount(
      presenter,
      <ScreenshotControl copyToClipboard baseName="gargo" withTime={false} onScreenshot={onScreenshot} />
    );

    let handled = false;
    act(() => {
      handled = controls().toolbarAction('screenshot');
    });
    expect(handled).toBe(true);
    expect(presenter.saveScreenshot).toHaveBeenCalledTimes(1);

    await waitFor(() => expect(onScreenshot).toHaveBeenCalledWith(`data:image/png;base64,${PNG_B64}`));
    await waitFor(() => expect(write).toHaveBeenCalledTimes(1));
    expect(click).toHaveBeenCalledTimes(1);
    const anchor = click.mock.instances[0] as HTMLAnchorElement;
    expect(anchor.download).toBe('gargo.png');
    expect(presenter._scene.config.autoSaveScreenshot).toBe(true);
  });

  it('download={false} skips the file and reports errors via onError', async () => {
    const presenter = withScreenshot(createMockPresenter());
    const onError = vi.fn();
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    const { controls } = mount(presenter, <ScreenshotControl copyToClipboard download={false} onError={onError} />);
    act(() => {
      controls().toolbarAction('screenshot');
    });
    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    expect(click).not.toHaveBeenCalled();
  });
});
