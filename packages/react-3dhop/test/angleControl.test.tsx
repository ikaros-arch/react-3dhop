// @vitest-environment jsdom
import React from 'react';
import { act, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AngleControl } from '../src/AngleControl.js';
import { Toolbar, ToolbarAssetsProvider, PickControl } from '../src/Toolbar.js';
import { createMockPresenter, type MockPresenter } from './mockPresenter.js';
import { ViewerHarness, type HarnessControls } from './harness.js';

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

describe('AngleControl', () => {
  it('renders the off/on icon pair from the skin assets and a hidden sidecar', () => {
    const presenter = createMockPresenter();
    const { container } = mount(presenter, <AngleControl />);
    const off = container.querySelector<HTMLImageElement>('[data-hop-id="angle"]');
    const on = container.querySelector<HTMLImageElement>('[data-hop-id="angle_on"]');
    expect(off?.src).toContain('/3dhop/skins/dark/angle.png');
    expect(on?.src).toContain('/3dhop/skins/dark/angle_on.png');
    expect(on?.style.visibility).toBe('hidden');

    const box = container.querySelector<HTMLDivElement>('[data-hop-sidecar="angle-box"]');
    expect(box).not.toBeNull();
    expect(box?.getAttribute('data-hop-anchor')).toBe('angle,angle_on');
    expect(box?.style.display).toBe('none');
    expect(box?.textContent).toContain('0.00°');
  });

  it('rides on pick-point mode and swaps icons / shows the sidecar when toggled', () => {
    const presenter = createMockPresenter();
    const { controls, container } = mount(presenter, <AngleControl />);

    act(() => controls().toggleTool('angle'));
    expect(controls().getActiveTool()).toBe('angle');
    expect(presenter.enablePickpointMode).toHaveBeenLastCalledWith(true);
    expect(container.querySelector<HTMLElement>('[data-hop-id="angle_on"]')?.style.visibility).toBe('visible');
    expect(container.querySelector<HTMLElement>('[data-hop-id="angle"]')?.style.visibility).toBe('hidden');
    expect(container.querySelector<HTMLElement>('[data-hop-sidecar="angle-box"]')?.style.display).toBe('table');

    act(() => controls().toggleTool('angle'));
    expect(controls().getActiveTool()).toBeNull();
    expect(presenter.enablePickpointMode).toHaveBeenLastCalledWith(false);
    expect(container.querySelector<HTMLElement>('[data-hop-sidecar="angle-box"]')?.style.display).toBe('none');
  });

  it('collects three picks, draws entities, reports the angle and restarts on the fourth', () => {
    const presenter = createMockPresenter();
    const onAngle = vi.fn();
    const { controls, container } = mount(presenter, <AngleControl onAngle={onAngle} />);
    const output = () => container.querySelector('[data-hop-sidecar="angle-box"]')?.textContent ?? '';

    act(() => controls().toggleTool('angle'));
    act(() => controls().pick([1, 0, 0]));
    expect(presenter._scene.entities['angle-points']).toBeDefined();
    expect(presenter._scene.entities['angle-lines']).toBeUndefined();

    act(() => controls().pick([0, 0, 0]));
    expect(presenter._scene.entities['angle-lines']).toBeDefined();
    expect(presenter._scene.entities['angle-wedge']).toBeUndefined();
    expect(onAngle).not.toHaveBeenCalled();

    act(() => controls().pick([0, 1, 0]));
    expect(presenter._scene.entities['angle-wedge']).toBeDefined();
    expect(presenter._scene.entities['angle-wedge'].useTransparency).toBe(true);
    expect(output()).toContain('90.00°');
    expect(onAngle).toHaveBeenCalledTimes(1);
    expect(onAngle.mock.calls[0][0]).toBeCloseTo(90);
    expect(onAngle.mock.calls[0][1]).toEqual([[1, 0, 0], [0, 0, 0], [0, 1, 0]]);

    // A fourth pick starts a new measurement.
    act(() => controls().pick([5, 5, 5]));
    expect(presenter._scene.entities['angle-points'].renderable).toEqual({ vertexCount: 1 });
    expect(presenter._scene.entities['angle-lines']).toBeUndefined();
    expect(presenter._scene.entities['angle-wedge']).toBeUndefined();
  });

  it('clears entities when the tool is switched off', () => {
    const presenter = createMockPresenter();
    const { controls } = mount(presenter, <AngleControl />);
    act(() => controls().toggleTool('angle'));
    act(() => controls().pick([1, 0, 0]));
    act(() => controls().pick([0, 0, 0]));
    expect(presenter._scene.entities['angle-lines']).toBeDefined();

    act(() => controls().toggleTool('angle'));
    expect(presenter._scene.entities['angle-points']).toBeUndefined();
    expect(presenter._scene.entities['angle-lines']).toBeUndefined();
  });

  it('is mutually exclusive with the pick tool that shares the presenter mode', () => {
    const presenter = createMockPresenter();
    const { controls, container } = mount(
      presenter,
      <>
        <PickControl />
        <AngleControl />
      </>
    );

    act(() => controls().toggleTool('pick'));
    expect(controls().getActiveTool()).toBe('pick');

    act(() => controls().toggleTool('angle'));
    expect(controls().getActiveTool()).toBe('angle');
    expect(presenter.isPickpointModeEnabled?.()).toBe(true);
    expect(container.querySelector<HTMLElement>('[data-hop-sidecar="angle-box"]')?.style.display).toBe('table');

    // A pick now goes to the angle tool, not to the shared pick-point output.
    act(() => controls().pick([1, 2, 3]));
    expect(presenter._scene.entities['angle-points']).toBeDefined();
    expect(container.querySelector('#pickpoint-output')?.textContent).toContain('[ 0 , 0 , 0 ]');

    act(() => controls().toggleTool('pick'));
    expect(controls().getActiveTool()).toBe('pick');
    expect(presenter._scene.entities['angle-points']).toBeUndefined();
  });

  it('removes its entities and deactivates on unmount', () => {
    const presenter = createMockPresenter();
    const { controls, unmount } = mount(presenter, <AngleControl />);
    act(() => controls().toggleTool('angle'));
    act(() => controls().pick([1, 0, 0]));
    expect(presenter._scene.entities['angle-points']).toBeDefined();

    unmount();
    expect(presenter._scene.entities['angle-points']).toBeUndefined();
    expect(presenter.enablePickpointMode).toHaveBeenLastCalledWith(false);
  });
});
