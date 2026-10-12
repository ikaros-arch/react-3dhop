// @vitest-environment jsdom
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SectionsControl } from '../src/SectionsControl.js';
import { Toolbar, ToolbarAssetsProvider } from '../src/Toolbar.js';
import { createMockPresenter, nexusMesh, type MockPresenter } from './mockPresenter.js';
import { ViewerHarness, type HarnessControls } from './harness.js';

function sceneWithGeometry() {
  return createMockPresenter({
    meshes: { m: nexusMesh([[-2, 0, -2], [2, 3, 2]]) },
    modelInstances: { i: { mesh: 'm' } }
  });
}

function mount(presenter: MockPresenter, children: React.ReactNode) {
  const controls: React.MutableRefObject<HarnessControls | null> = { current: null };
  const utils = render(
    <ViewerHarness presenter={presenter} controlsRef={controls}>
      <ToolbarAssetsProvider assetBaseUrl="/3dhop">
        <div data-hop-toolbar-container="true">
          <Toolbar>{children}</Toolbar>
        </div>
      </ToolbarAssetsProvider>
    </ViewerHarness>
  );
  return { controls: () => controls.current!, ...utils };
}

describe('SectionsControl', () => {
  it('renders the icon pair, starts closed, and zeroes clipping on open/close', () => {
    const presenter = sceneWithGeometry();
    const { controls, container } = mount(presenter, <SectionsControl />);
    const on = () => container.querySelector<HTMLElement>('[data-hop-id="sections_on"]')!;
    const off = () => container.querySelector<HTMLElement>('[data-hop-id="sections"]')!;
    const box = () => container.querySelector<HTMLElement>('[data-hop-sidecar="sections-box"]')!;

    expect(on().style.visibility).toBe('hidden');
    expect(off().style.visibility).toBe('visible');
    expect(box().style.display).toBe('none');
    expect(presenter.__clipAxis).toEqual([0, 0, 0]);

    act(() => {
      controls().toolbarAction('sections');
    });
    expect(on().style.visibility).toBe('visible');
    expect(off().style.visibility).toBe('hidden');
    expect(box().style.display).toBe('table');

    act(() => {
      controls().toolbarAction('sections_on');
    });
    expect(box().style.display).toBe('none');
    expect(presenter.__clipAxis).toEqual([0, 0, 0]);
  });

  it('enables an axis from the sidecar icon and clips in the flipped direction', () => {
    const presenter = sceneWithGeometry();
    const { controls, container } = mount(presenter, <SectionsControl />);
    act(() => controls().toolbarAction('sections'));

    const xIcon = container.querySelector<HTMLImageElement>('[data-hop-section-axis="x"]')!;
    fireEvent.click(xIcon);
    expect(presenter.getClippingX!()).toBe(1);

    const xFlip = container.querySelector<HTMLInputElement>('[data-hop-section-flip="x"]')!;
    fireEvent.click(xFlip);
    expect(presenter.getClippingX!()).toBe(-1);

    fireEvent.click(xIcon);
    expect(presenter.getClippingX!()).toBe(0);
  });

  it('moves the slider, auto-enabling the axis', () => {
    const presenter = sceneWithGeometry();
    const { controls, container } = mount(presenter, <SectionsControl />);
    act(() => controls().toolbarAction('sections'));

    const slider = container.querySelector<HTMLInputElement>('[data-hop-section-slider="y"]')!;
    fireEvent.change(slider, { target: { valueAsNumber: 0.25 } });

    expect(presenter.getClippingY!()).toBe(1);
    expect(presenter.__clipPoint[1]).toBe(0.25);
  });

  it('toggles plane/edge rendering', () => {
    const presenter = sceneWithGeometry();
    const { controls, container } = mount(presenter, <SectionsControl />);
    act(() => controls().toolbarAction('sections'));

    const planes = container.querySelector<HTMLInputElement>('[data-hop-section-show-planes]')!;
    fireEvent.click(planes);
    expect(presenter.getClippingRendermode!()).toEqual([false, true]);

    const edges = container.querySelector<HTMLInputElement>('[data-hop-section-show-edges]')!;
    fireEvent.click(edges);
    expect(presenter.getClippingRendermode!()).toEqual([false, false]);
  });

  it('survives a scene apply, unlike the legacy sidecar which reset to the midpoint', () => {
    const presenter = sceneWithGeometry();
    const { controls, container } = mount(presenter, <SectionsControl />);
    act(() => controls().toolbarAction('sections'));

    const slider = container.querySelector<HTMLInputElement>('[data-hop-section-slider="z"]')!;
    fireEvent.change(slider, { target: { valueAsNumber: 0.8 } });
    expect(presenter.__clipPoint[2]).toBe(0.8);

    act(() => controls().applyScene());

    expect(presenter.__clipPoint[2]).toBe(0.8);
    expect(presenter.getClippingZ!()).toBe(1);
  });

  it('works controlled: reports intent without changing until the parent does', () => {
    const presenter = sceneWithGeometry();
    const onStateChange = vi.fn();
    const onOpenChange = vi.fn();
    const { controls, container } = mount(
      presenter,
      <SectionsControl open={false} onOpenChange={onOpenChange} onStateChange={onStateChange} />
    );

    act(() => controls().toolbarAction('sections'));
    expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(container.querySelector<HTMLElement>('[data-hop-sidecar="sections-box"]')!.style.display).toBe('none');
  });
});
