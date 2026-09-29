// @vitest-environment jsdom
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LightDirectionWidget } from '../src/LightDirectionWidget.js';
import { createMockPresenter, type MockPresenter } from './mockPresenter.js';
import { ViewerHarness, type HarnessControls } from './harness.js';

function mount(presenter: MockPresenter, ui: React.ReactNode) {
  const controls: React.MutableRefObject<HarnessControls | null> = { current: null };
  const utils = render(
    <ViewerHarness presenter={presenter} controlsRef={controls}>
      {ui}
    </ViewerHarness>
  );
  const canvas = utils.container.querySelector('canvas')!;
  // jsdom has no layout: give the canvas its nominal box so pointer math works.
  vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    top: 0,
    width: 126,
    height: 126,
    right: 126,
    bottom: 126,
    x: 0,
    y: 0,
    toJSON: () => ({})
  } as DOMRect);
  return { controls: () => controls.current!, canvas, ...utils };
}

describe('LightDirectionWidget', () => {
  beforeEach(() => {
    // jsdom's canvas has no 2D context; the widget must cope (drawing is skipped).
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  });

  it('renders a slider-role canvas of the requested size', () => {
    const presenter = createMockPresenter();
    const { canvas } = mount(presenter, <LightDirectionWidget size={100} position="bottom-left" />);
    expect(canvas.getAttribute('role')).toBe('slider');
    expect(canvas.width).toBe(100);
    expect(canvas.getAttribute('aria-valuetext')).toBe('x 0.00, y 0.00');
  });

  it('rotates the light when pressed inside the disc, with screen-y flipped', () => {
    const presenter = createMockPresenter();
    const onChange = vi.fn();
    const { canvas } = mount(presenter, <LightDirectionWidget onChange={onChange} />);

    // 30 px right, 30 px up from the centre → disc (0.25, -0.25) → rotateLight(0.25, 0.25).
    fireEvent.pointerDown(canvas, { clientX: 63 + 30, clientY: 63 - 30, pointerId: 1 });
    expect(presenter.rotateLight).toHaveBeenCalledTimes(1);
    const [x, y] = (presenter.rotateLight as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(x).toBeCloseTo(0.25);
    expect(y).toBeCloseTo(0.25);
    expect(onChange).toHaveBeenCalledWith([expect.closeTo(0.25, 5), expect.closeTo(-0.25, 5)]);
  });

  it('ignores presses outside the disc and moves without a press', () => {
    const presenter = createMockPresenter();
    const { canvas } = mount(presenter, <LightDirectionWidget />);
    fireEvent.pointerDown(canvas, { clientX: 2, clientY: 2, pointerId: 1 });
    fireEvent.pointerMove(canvas, { clientX: 63, clientY: 63, pointerId: 1 });
    expect(presenter.rotateLight).not.toHaveBeenCalled();
  });

  it('drags: moves after a press update the light until release', () => {
    const presenter = createMockPresenter();
    const { canvas } = mount(presenter, <LightDirectionWidget />);
    fireEvent.pointerDown(canvas, { clientX: 63, clientY: 63, pointerId: 1 });
    fireEvent.pointerMove(canvas, { clientX: 70, clientY: 63, pointerId: 1 });
    fireEvent.pointerMove(canvas, { clientX: 80, clientY: 63, pointerId: 1 });
    expect(presenter.rotateLight).toHaveBeenCalledTimes(3);
    fireEvent.pointerUp(canvas, { clientX: 80, clientY: 63, pointerId: 1 });
    fireEvent.pointerMove(canvas, { clientX: 90, clientY: 63, pointerId: 1 });
    expect(presenter.rotateLight).toHaveBeenCalledTimes(3);
  });

  it('reflects light changes made elsewhere (e.g. Home reset)', () => {
    const presenter = createMockPresenter();
    const { controls, canvas } = mount(presenter, <LightDirectionWidget />);
    act(() => {
      presenter.rotateLight?.(0.2, -0.1);
      controls().emitLight();
    });
    // _lightDirection = [-0.4, 0.2, -z] → disc = [0.2, 0.1]
    expect(canvas.getAttribute('aria-valuetext')).toBe('x 0.20, y 0.10');

    act(() => {
      presenter.resetTrackball();
      controls().emitLight();
    });
    expect(canvas.getAttribute('aria-valuetext')).toBe('x 0.00, y 0.00');
  });
});
