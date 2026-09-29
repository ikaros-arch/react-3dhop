// @vitest-environment jsdom
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GridControl, GridOverlay } from '../src/GridControl.js';
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

const entityNames = (p: MockPresenter) => Object.keys(p._scene.entities).sort();

describe('GridOverlay', () => {
  it('draws nothing when off and one entity per grid mode', () => {
    const presenter = sceneWithGeometry();
    const { rerender } = render(
      <ViewerHarness presenter={presenter} controlsRef={{ current: null }}>
        <GridOverlay mode="off" />
      </ViewerHarness>
    );
    expect(entityNames(presenter)).toEqual([]);

    for (const [mode, expected] of [
      ['flat', ['r3dhop-grid-flat']],
      ['box', ['r3dhop-grid-box']],
      ['fixed', ['r3dhop-grid-fixed']],
      ['axes', ['r3dhop-axis-x', 'r3dhop-axis-y', 'r3dhop-axis-z']]
    ] as const) {
      rerender(
        <ViewerHarness presenter={presenter} controlsRef={{ current: null }}>
          <GridOverlay mode={mode} />
        </ViewerHarness>
      );
      expect(entityNames(presenter)).toEqual([...expected]);
    }
  });

  it('uses the viewer measurement unit for the step and honours an override', () => {
    const presenter = sceneWithGeometry();
    // Harness sets measurementUnits="mm" → step 10 → radius ~3.5 → floor(3.5/10)=0 → clamped to 1 line each way.
    const { rerender } = render(
      <ViewerHarness presenter={presenter} controlsRef={{ current: null }}>
        <GridOverlay mode="flat" />
      </ViewerHarness>
    );
    const lastVertexCount = () => {
      const calls = (presenter.createEntity as ReturnType<typeof vi.fn>).mock.calls;
      return calls[calls.length - 1][2].length as number;
    };
    const coarse = lastVertexCount();

    rerender(
      <ViewerHarness presenter={presenter} controlsRef={{ current: null }}>
        <GridOverlay mode="flat" step={0.5} />
      </ViewerHarness>
    );
    const fine = lastVertexCount();
    expect(fine).toBeGreaterThan(coarse);
  });

  it('puts axes at the world origin when asked', () => {
    const presenter = sceneWithGeometry();
    render(
      <ViewerHarness presenter={presenter} controlsRef={{ current: null }}>
        <GridOverlay mode="axes" axesOrigin="world" />
      </ViewerHarness>
    );
    const call = (presenter.createEntity as ReturnType<typeof vi.fn>).mock.calls.find((c) => c[0] === 'r3dhop-axis-x')!;
    expect(call[2][0]).toEqual([0, 0, 0]);
  });

  it('survives a scene apply', () => {
    const presenter = sceneWithGeometry();
    const controls: React.MutableRefObject<HarnessControls | null> = { current: null };
    render(
      <ViewerHarness presenter={presenter} controlsRef={controls}>
        <GridOverlay mode="flat" />
      </ViewerHarness>
    );
    act(() => controls.current!.applyScene());
    expect(entityNames(presenter)).toEqual(['r3dhop-grid-flat']);
  });
});

describe('GridControl', () => {
  it('renders the icon pair, starts off, and toggles through the toolbar action', () => {
    const presenter = sceneWithGeometry();
    const { controls, container } = mount(presenter, <GridControl />);
    const on = () => container.querySelector<HTMLElement>('[data-hop-id="grid_on"]')!;
    const off = () => container.querySelector<HTMLElement>('[data-hop-id="grid"]')!;
    const box = () => container.querySelector<HTMLElement>('[data-hop-sidecar="grid-box"]')!;

    expect(off().getAttribute('src')).toContain('/3dhop/skins/dark/grid.svg');
    expect(on().style.visibility).toBe('hidden');
    expect(box().style.display).toBe('none');
    expect(entityNames(presenter)).toEqual([]);

    let handled = false;
    act(() => {
      handled = controls().toolbarAction('grid');
    });
    expect(handled).toBe(true);
    expect(entityNames(presenter)).toEqual(['r3dhop-grid-flat']);
    expect(on().style.visibility).toBe('visible');
    expect(off().style.visibility).toBe('hidden');
    expect(box().style.display).toBe('table');

    act(() => {
      controls().toolbarAction('grid_on');
    });
    expect(entityNames(presenter)).toEqual([]);
    expect(box().style.display).toBe('none');
  });

  it('switches modes from the sidecar and remembers the last mode when re-enabled', () => {
    const presenter = sceneWithGeometry();
    const onModeChange = vi.fn();
    const { controls, container } = mount(presenter, <GridControl onModeChange={onModeChange} />);

    act(() => {
      controls().toolbarAction('grid');
    });
    const axesButton = container.querySelector<HTMLButtonElement>('[data-hop-grid-mode="axes"]')!;
    fireEvent.click(axesButton);
    expect(entityNames(presenter)).toEqual(['r3dhop-axis-x', 'r3dhop-axis-y', 'r3dhop-axis-z']);
    expect(axesButton.getAttribute('aria-pressed')).toBe('true');
    expect(onModeChange).toHaveBeenLastCalledWith('axes');

    act(() => {
      controls().toolbarAction('grid');
    });
    expect(entityNames(presenter)).toEqual([]);
    act(() => {
      controls().toolbarAction('grid');
    });
    expect(entityNames(presenter)).toEqual(['r3dhop-axis-x', 'r3dhop-axis-y', 'r3dhop-axis-z']);
  });

  it('works controlled: reports intent without changing until the parent does', () => {
    const presenter = sceneWithGeometry();
    const onModeChange = vi.fn();
    const { controls, rerender } = mount(presenter, <GridControl mode="off" onModeChange={onModeChange} />);

    act(() => {
      controls().toolbarAction('grid');
    });
    expect(onModeChange).toHaveBeenCalledWith('flat');
    expect(entityNames(presenter)).toEqual([]);

    const ctrl: React.MutableRefObject<HarnessControls | null> = { current: null };
    rerender(
      <ViewerHarness presenter={presenter} controlsRef={ctrl}>
        <ToolbarAssetsProvider assetBaseUrl="/3dhop">
          <div data-hop-toolbar-container="true">
            <Toolbar>
              <GridControl mode="box" onModeChange={onModeChange} />
            </Toolbar>
          </div>
        </ToolbarAssetsProvider>
      </ViewerHarness>
    );
    expect(entityNames(presenter)).toEqual(['r3dhop-grid-box']);
  });

  it('respects defaultOnMode, a restricted mode list and a hidden picker', () => {
    const presenter = sceneWithGeometry();
    const { controls, container } = mount(
      presenter,
      <GridControl defaultOnMode="box" modes={['box', 'axes']} showModePicker={false} />
    );
    expect(container.querySelector('[data-hop-sidecar="grid-box"]')).toBeNull();
    act(() => {
      controls().toolbarAction('grid');
    });
    expect(entityNames(presenter)).toEqual(['r3dhop-grid-box']);
  });

  it('removes its entities on unmount', () => {
    const presenter = sceneWithGeometry();
    const { unmount } = mount(presenter, <GridControl defaultMode="flat" />);
    expect(entityNames(presenter)).toEqual(['r3dhop-grid-flat']);
    unmount();
    expect(entityNames(presenter)).toEqual([]);
  });
});
