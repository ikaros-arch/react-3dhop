// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ViewPresetButtons } from '../src/ViewPresetButtons.js';
import { useViewPresets } from '../src/hooks/useViewPresets.js';
import { createMockPresenter, type MockPresenter } from './mockPresenter.js';
import { ViewerHarness } from './harness.js';

const wrap = (presenter: MockPresenter) =>
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <ViewerHarness presenter={presenter} controlsRef={{ current: null }}>
        {children}
      </ViewerHarness>
    );
  };

describe('useViewPresets', () => {
  it('animates when the presenter supports it', () => {
    const presenter = createMockPresenter();
    presenter.animateToTrackballPosition = vi.fn();
    const { result } = renderHook(() => useViewPresets(), { wrapper: wrap(presenter) });
    result.current.viewFrom('top');
    expect(presenter.animateToTrackballPosition).toHaveBeenCalledWith([0, 90, 0, 0, 0, 2.5], 0.8);
  });

  it('falls back to setTrackballPosition + repaint when animation is unavailable or zero', () => {
    const presenter = createMockPresenter();
    const { result } = renderHook(() => useViewPresets({ animationSeconds: 0 }), { wrapper: wrap(presenter) });
    result.current.viewFrom('left');
    expect(presenter.setTrackballPosition).toHaveBeenCalledWith([270, 0, 0, 0, 0, 2.5]);
    expect(presenter.repaint).toHaveBeenCalled();
    expect(presenter.getTrackballPosition?.()).toEqual([270, 0, 0, 0, 0, 2.5]);
  });

  it('honours per-call overrides', () => {
    const presenter = createMockPresenter();
    presenter.animateToTrackballPosition = vi.fn();
    const { result } = renderHook(() => useViewPresets(), { wrapper: wrap(presenter) });
    result.current.viewFrom({ phi: 45 }, { preservePanAndDistance: false, targetDistance: 3, animationSeconds: 2 });
    expect(presenter.animateToTrackballPosition).toHaveBeenCalledWith([45, 15, 0, 0, 0, 3], 2);
  });
});

describe('ViewPresetButtons', () => {
  it('renders the requested presets and drives the camera on click', () => {
    const presenter = createMockPresenter();
    presenter.animateToTrackballPosition = vi.fn();
    const onSelect = vi.fn();
    const { container } = render(
      <ViewerHarness presenter={presenter} controlsRef={{ current: null }}>
        <ViewPresetButtons presets={['front', 'top']} labels={{ top: 'Above' }} onSelect={onSelect} />
      </ViewerHarness>
    );
    const buttons = Array.from(container.querySelectorAll('button'));
    expect(buttons.map((b) => b.textContent)).toEqual(['Front', 'Above']);

    fireEvent.click(buttons[1]);
    expect(presenter.animateToTrackballPosition).toHaveBeenCalledWith([0, 90, 0, 0, 0, 2.5], 0.8);
    expect(onSelect).toHaveBeenCalledWith('top');
  });

  it('positions itself absolutely when given a corner', () => {
    const presenter = createMockPresenter();
    const { container } = render(
      <ViewerHarness presenter={presenter} controlsRef={{ current: null }}>
        <ViewPresetButtons position="bottom-left" />
      </ViewerHarness>
    );
    const group = container.querySelector<HTMLElement>('[data-hop-view-presets]')!;
    expect(group.style.position).toBe('absolute');
    expect(group.style.bottom).toBe('16px');
    expect(group.querySelectorAll('button')).toHaveLength(6);
  });
});
