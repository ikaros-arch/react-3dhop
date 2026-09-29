// @vitest-environment jsdom
import React from 'react';
import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSceneEntity } from '../src/hooks/useSceneEntity.js';
import { useSceneBounds } from '../src/hooks/useSceneBounds.js';
import { useSceneReady } from '../src/hooks/useSceneReady.js';
import { useLightDirection } from '../src/hooks/useLightDirection.js';
import type { SceneBounds, SceneEntitySpec, Vector3 } from '../src/viewer/types.js';
import { createMockPresenter, nexusMesh, sphereOnlyMesh, type MockPresenter } from './mockPresenter.js';
import { ViewerHarness, type HarnessControls } from './harness.js';

function mount(presenter: MockPresenter, children: React.ReactNode) {
  const controls: React.MutableRefObject<HarnessControls | null> = { current: null };
  const utils = render(
    <ViewerHarness presenter={presenter} controlsRef={controls}>
      {children}
    </ViewerHarness>
  );
  return { controls: () => controls.current!, ...utils };
}

describe('useSceneEntity', () => {
  const Grid: React.FC<{ spec: SceneEntitySpec | null; dep?: number }> = ({ spec, dep = 0 }) => {
    useSceneEntity('grid', () => spec, [spec, dep]);
    return null;
  };
  const spec: SceneEntitySpec = {
    type: 'lines',
    vertices: [[0, 0, 0], [1, 0, 0]],
    color: [0.5, 0.5, 0.5, 0.8],
    zOff: 0.01,
    useTransparency: true
  };

  it('creates the entity on mount with the spec applied and repaints', () => {
    const presenter = createMockPresenter();
    mount(presenter, <Grid spec={spec} />);
    const entity = presenter._scene.entities.grid;
    expect(entity).toBeDefined();
    expect(entity.color).toEqual([0.5, 0.5, 0.5, 0.8]);
    expect(entity.zOff).toBe(0.01);
    expect(entity.useTransparency).toBe(true);
    expect(presenter.createEntity).toHaveBeenCalledWith('grid', 'lines', spec.vertices);
    expect(presenter.repaint).toHaveBeenCalled();
  });

  it('re-creates the entity after a scene apply wipes it', () => {
    const presenter = createMockPresenter();
    const { controls } = mount(presenter, <Grid spec={spec} />);
    expect(presenter.createEntity).toHaveBeenCalledTimes(1);

    act(() => controls().applyScene());
    expect(presenter._scene.entities.grid).toBeDefined();
    expect(presenter.createEntity).toHaveBeenCalledTimes(2);
  });

  it('re-runs the factory when the scene becomes ready', () => {
    const presenter = createMockPresenter();
    const factory = vi.fn(() => spec);
    const Probe: React.FC = () => {
      useSceneEntity('grid', factory);
      return null;
    };
    const { controls } = mount(presenter, <Probe />);
    expect(factory).toHaveBeenCalledTimes(1);
    act(() => controls().finishLoading());
    expect(factory).toHaveBeenCalledTimes(2);
  });

  it('draws nothing when the factory returns null, and removes a previous entity', () => {
    const presenter = createMockPresenter();
    const { rerender } = mount(presenter, <Grid spec={spec} />);
    expect(presenter._scene.entities.grid).toBeDefined();
    rerender(
      <ViewerHarness presenter={presenter} controlsRef={{ current: null }}>
        <Grid spec={null} />
      </ViewerHarness>
    );
    expect(presenter._scene.entities.grid).toBeUndefined();
  });

  it('removes the entity on unmount', () => {
    const presenter = createMockPresenter();
    const { unmount } = mount(presenter, <Grid spec={spec} />);
    unmount();
    expect(presenter._scene.entities.grid).toBeUndefined();
    expect(presenter.deleteEntity).toHaveBeenCalledWith('grid');
  });
});

describe('useSceneReady', () => {
  it('tracks readiness across loading and scene applies', () => {
    const presenter = createMockPresenter();
    let ready: boolean | null = null;
    const Probe: React.FC = () => {
      ready = useSceneReady();
      return null;
    };
    const { controls } = mount(presenter, <Probe />);
    expect(ready).toBe(false);
    act(() => controls().finishLoading());
    expect(ready).toBe(true);
    act(() => controls().applyScene());
    expect(ready).toBe(false);
  });
});

describe('useSceneBounds', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('is null with no geometry and updates once the scene is ready', () => {
    const presenter = createMockPresenter();
    let bounds: SceneBounds | null | undefined;
    const Probe: React.FC = () => {
      bounds = useSceneBounds().bounds;
      return null;
    };
    const { controls } = mount(presenter, <Probe />);
    expect(bounds).toBeNull();

    presenter._scene.meshes.m = nexusMesh([[0, 0, 0], [2, 2, 2]]);
    presenter._scene.modelInstances.i = { mesh: 'm' };
    act(() => controls().finishLoading());
    expect(bounds?.max).toEqual([2, 2, 2]);
    expect(bounds?.source).toBe('vertices');
  });

  it('retries to upgrade sphere bounds to vertex bounds', () => {
    const presenter = createMockPresenter({
      meshes: { m: sphereOnlyMesh([0, 0, 0], 1) },
      modelInstances: { i: { mesh: 'm' } }
    });
    let bounds: SceneBounds | null | undefined;
    const Probe: React.FC = () => {
      bounds = useSceneBounds({ retryIntervalMs: 100, maxRetries: 3 }).bounds;
      return null;
    };
    const { controls } = mount(presenter, <Probe />);
    act(() => controls().finishLoading());
    expect(bounds?.source).toBe('spheres');

    // Base level arrives later.
    presenter._scene.meshes.m = nexusMesh([[-1, -1, -1], [1, 1, 1]]);
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(bounds?.source).toBe('vertices');
  });

  it('gives up after maxRetries', () => {
    const presenter = createMockPresenter({
      meshes: { m: sphereOnlyMesh([0, 0, 0], 1) },
      modelInstances: { i: { mesh: 'm' } }
    });
    const Probe: React.FC = () => {
      useSceneBounds({ retryIntervalMs: 50, maxRetries: 2 });
      return null;
    };
    const { controls } = mount(presenter, <Probe />);
    act(() => controls().finishLoading());
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('useLightDirection', () => {
  it('receives the initial direction and follows rotateLight', () => {
    const presenter = createMockPresenter();
    let direction: Vector3 | null = null;
    let setFromDisc: ((x: number, y: number) => void) | null = null;
    const Probe: React.FC = () => {
      const light = useLightDirection();
      direction = light.direction;
      setFromDisc = light.setFromDisc;
      return null;
    };
    const { controls } = mount(presenter, <Probe />);
    expect(direction).toEqual([0, 0, -1]);

    act(() => {
      setFromDisc!(0.25, 0);
      controls().emitLight();
    });
    expect(presenter.rotateLight).toHaveBeenCalledWith(0.25, 0);
    expect(direction![0]).toBeCloseTo(-0.5);
  });
});
