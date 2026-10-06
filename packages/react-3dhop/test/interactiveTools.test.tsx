// @vitest-environment jsdom
import React, { useEffect } from 'react';
import { act, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useThreeDHopViewer } from '../src/viewer/context.js';
import type { InteractiveToolConfig, InteractiveToolPickContext } from '../src/viewer/types.js';
import { createMockPresenter } from './mockPresenter.js';
import { ViewerHarness, type HarnessControls } from './harness.js';

/** Registers a tool through context, the way a custom control would. */
const RegisterTool: React.FC<{ config: InteractiveToolConfig }> = ({ config }) => {
  const { registerInteractiveTool } = useThreeDHopViewer();
  useEffect(() => registerInteractiveTool(config), [config, registerInteractiveTool]);
  return null;
};

const ActiveToolProbe: React.FC<{ onRender: (id: string | null) => void }> = ({ onRender }) => {
  const { activeInteractiveTool } = useThreeDHopViewer();
  onRender(activeInteractiveTool);
  return null;
};

function setup(children: React.ReactNode = null, corrections?: [number, number, number]) {
  const presenter = createMockPresenter();
  const controls: React.MutableRefObject<HarnessControls | null> = { current: null };
  const utils = render(
    <ViewerHarness presenter={presenter} controlsRef={controls} coordinateCorrections={corrections}>
      {children}
    </ViewerHarness>
  );
  return { presenter, controls: () => controls.current!, ...utils };
}

describe('interactive tool registry', () => {
  it('toggles the built-in measure tool on and off', () => {
    const { presenter, controls } = setup();
    act(() => controls().toggleTool('measure'));
    expect(presenter.__measureEnabled).toBe(true);
    expect(controls().getActiveTool()).toBe('measure');
    act(() => controls().toggleTool('measure'));
    expect(presenter.__measureEnabled).toBe(false);
    expect(controls().getActiveTool()).toBeNull();
  });

  it('enforces exclusivity between built-in tools', () => {
    const { presenter, controls } = setup();
    act(() => controls().toggleTool('measure'));
    act(() => controls().toggleTool('pick'));
    expect(presenter.__measureEnabled).toBe(false);
    expect(presenter.__pickEnabled).toBe(true);
    expect(controls().getActiveTool()).toBe('pick');
  });

  it('keeps the active tool enabled across a scene apply (3DHOP resets it in setScene)', () => {
    const { presenter, controls } = setup();
    act(() => controls().toggleTool('pick'));
    expect(presenter.__pickEnabled).toBe(true);
    act(() => controls().applyScene());
    expect(presenter.__pickEnabled).toBe(true);
    expect(controls().getActiveTool()).toBe('pick');

    act(() => controls().toggleTool('pick'));
    act(() => controls().applyScene());
    expect(presenter.__pickEnabled).toBe(false);
  });

  it('accepts a custom tool and keeps it exclusive with built-ins', () => {
    const enable = vi.fn();
    const seen: Array<string | null> = [];
    const config: InteractiveToolConfig = { id: 'angle', enable };
    const { presenter, controls } = setup(
      <>
        <RegisterTool config={config} />
        <ActiveToolProbe onRender={(id) => seen.push(id)} />
      </>
    );

    act(() => controls().toggleTool('pick'));
    act(() => controls().toggleTool('angle'));

    expect(presenter.__pickEnabled).toBe(false);
    expect(enable).toHaveBeenLastCalledWith(presenter, true);
    expect(controls().getActiveTool()).toBe('angle');
    expect(seen[seen.length - 1]).toBe('angle');

    act(() => controls().toggleTool('measure'));
    expect(enable).toHaveBeenLastCalledWith(presenter, false);
    expect(controls().getActiveTool()).toBe('measure');
  });

  it('ignores unknown tool ids', () => {
    const { controls } = setup();
    act(() => controls().toggleTool('nope'));
    expect(controls().getActiveTool()).toBeNull();
  });

  it('switches between two tools that share the same presenter mode', () => {
    // Angle rides on pick-point mode: isEnabled would report true while pick is active.
    const config: InteractiveToolConfig = {
      id: 'angle',
      enable: (p, on) => p.enablePickpointMode?.(on),
      isEnabled: (p) => p.isPickpointModeEnabled?.()
    };
    const { presenter, controls } = setup(<RegisterTool config={config} />);

    act(() => controls().toggleTool('pick'));
    expect(controls().getActiveTool()).toBe('pick');
    act(() => controls().toggleTool('angle'));
    expect(controls().getActiveTool()).toBe('angle');
    expect(presenter.__pickEnabled).toBe(true);
    act(() => controls().toggleTool('pick'));
    expect(controls().getActiveTool()).toBe('pick');
    expect(presenter.__pickEnabled).toBe(true);
    act(() => controls().toggleTool('pick'));
    expect(controls().getActiveTool()).toBeNull();
    expect(presenter.__pickEnabled).toBe(false);
  });

  it('deactivates and forgets a custom tool when its registration is disposed', () => {
    const enable = vi.fn();
    const config: InteractiveToolConfig = { id: 'angle', enable };
    const { controls, rerender, presenter } = setup(<RegisterTool config={config} />);
    act(() => controls().toggleTool('angle'));
    expect(controls().getActiveTool()).toBe('angle');

    rerender(
      <ViewerHarness presenter={presenter} controlsRef={{ current: null }}>
        {null}
      </ViewerHarness>
    );
    expect(enable).toHaveBeenLastCalledWith(presenter, false);
  });
});

describe('pick dispatch', () => {
  it('routes picks to the active tool with raw and corrected coordinates', () => {
    const picks: InteractiveToolPickContext[] = [];
    const config: InteractiveToolConfig = {
      id: 'angle',
      enable: (p, on) => p.enablePickpointMode?.(on),
      isEnabled: (p) => p.isPickpointModeEnabled?.(),
      onPick: (ctx) => picks.push(ctx)
    };
    const { controls } = setup(<RegisterTool config={config} />, [100, 200, 300]);

    act(() => controls().toggleTool('angle'));
    act(() => controls().pick([1, 2, 3]));

    expect(picks).toHaveLength(1);
    expect(picks[0].raw).toEqual([1, 2, 3]);
    expect(picks[0].corrected).toEqual([101, 202, 303]);
  });

  it('falls back to the shared pickpoint value when the pick tool is active', () => {
    let value: [number, number, number] | null = null;
    const Probe: React.FC = () => {
      value = useThreeDHopViewer().pickpointValue;
      return null;
    };
    const { controls } = setup(<Probe />, [10, 0, 0]);
    act(() => controls().toggleTool('pick'));
    act(() => controls().pick([1, 1, 1]));
    expect(value).toEqual([11, 1, 1]);
  });

  it('does not feed the pick tool output while another tool owns the pick', () => {
    let value: [number, number, number] | null = null;
    const Probe: React.FC = () => {
      value = useThreeDHopViewer().pickpointValue;
      return null;
    };
    const config: InteractiveToolConfig = { id: 'angle', onPick: () => {} };
    const { controls } = setup(
      <>
        <RegisterTool config={config} />
        <Probe />
      </>
    );
    act(() => controls().toggleTool('angle'));
    act(() => controls().pick([1, 1, 1]));
    expect(value).toBeNull();
  });
});

describe('tool state capture/restore', () => {
  it('captures a custom tool\'s state while it is active, defaulting to the active tool', () => {
    let points: number[] = [];
    const config: InteractiveToolConfig = {
      id: 'angle',
      captureState: () => points,
      restoreState: (state) => {
        points = state as number[];
      }
    };
    const { controls } = setup(<RegisterTool config={config} />);

    points = [1, 2, 3];
    act(() => controls().toggleTool('angle'));
    expect(controls().captureToolState()).toEqual({ toolId: 'angle', state: [1, 2, 3] });
    // An explicit id works the same as defaulting to the active tool.
    expect(controls().captureToolState('angle')).toEqual({ toolId: 'angle', state: [1, 2, 3] });
  });

  it('returns null when there is no active tool, or the active tool has no captureState', () => {
    const { controls } = setup(<RegisterTool config={{ id: 'angle' }} />);
    expect(controls().captureToolState()).toBeNull();
    act(() => controls().toggleTool('angle'));
    expect(controls().captureToolState()).toBeNull();
  });

  it('restoreToolState activates the tool if needed, then hands it the state', () => {
    const restoreState = vi.fn();
    const { controls } = setup(<RegisterTool config={{ id: 'angle', restoreState }} />);

    expect(controls().getActiveTool()).toBeNull();
    act(() => controls().restoreToolState('angle', [1, 2, 3]));
    expect(controls().getActiveTool()).toBe('angle');
    expect(restoreState).toHaveBeenCalledWith([1, 2, 3]);
  });

  it('round-trips the built-in pick tool\'s point through capture/restore', () => {
    let value: [number, number, number] | null = null;
    const Probe: React.FC = () => {
      value = useThreeDHopViewer().pickpointValue;
      return null;
    };
    const { controls } = setup(<Probe />);

    act(() => controls().toggleTool('pick'));
    act(() => controls().pick([4, 5, 6]));
    const captured = controls().captureToolState();
    expect(captured).toEqual({ toolId: 'pick', state: [4, 5, 6] });

    act(() => controls().toggleTool('pick')); // deactivate, clearing nothing but proving restore re-activates
    act(() => controls().restoreToolState('pick', captured!.state));
    expect(controls().getActiveTool()).toBe('pick');
    expect(value).toEqual([4, 5, 6]);
  });

  it('round-trips the built-in measure tool\'s points through capture/restore', () => {
    let value: number | null = null;
    const Probe: React.FC = () => {
      value = useThreeDHopViewer().measurementValue;
      return null;
    };
    const { controls, presenter } = setup(<Probe />);

    act(() => controls().toggleTool('measure'));
    act(() => controls().completeMeasurement([0, 0, 0], [3, 4, 0]));
    expect(value).toBe(5);

    const captured = controls().captureToolState();
    expect(captured).toEqual({ toolId: 'measure', state: [[0, 0, 0], [3, 4, 0]] });

    act(() => controls().toggleTool('measure')); // deactivate
    act(() => controls().restoreToolState('measure', captured!.state));
    expect(controls().getActiveTool()).toBe('measure');
    expect(value).toBe(5);
    expect(presenter.restoreMeasurement).toHaveBeenCalledWith([0, 0, 0], [3, 4, 0]);
  });

  it('captureToolState reports a null state for measure before any measurement has completed', () => {
    const { controls } = setup();
    act(() => controls().toggleTool('measure'));
    expect(controls().captureToolState()).toEqual({ toolId: 'measure', state: null });
  });
});
