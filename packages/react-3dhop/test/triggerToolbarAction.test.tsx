// @vitest-environment jsdom
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useThreeDHopViewer } from '../src/viewer/context.js';
import { createMockPresenter } from './mockPresenter.js';
import { ViewerHarness } from './harness.js';

/**
 * `triggerToolbarAction` exists so controls like `LightingControl`/`ColorControl`/`HomeControl`
 * keep working when their icon is rendered somewhere other than the real toolbar DOM (e.g. a
 * custom sidebar) - see the type's doc comment in viewer/types.ts for the full story. These
 * tests only cover that it reaches the registered-handler registry (the part this package
 * controls); the built-in actions (`home`, `lighting`, ...) live in the real lifecycle's
 * `toolbarHandler`, which this lightweight harness doesn't simulate.
 */
function DispatchButton({ action }: { action: string }) {
  const { triggerToolbarAction } = useThreeDHopViewer();
  return (
    <button type="button" onClick={() => triggerToolbarAction(action)}>
      dispatch
    </button>
  );
}

describe('triggerToolbarAction', () => {
  it('reaches a handler registered via registerToolbarAction, from a consumer outside the toolbar', () => {
    const presenter = createMockPresenter();
    let received: string[] = [];

    function Registrar() {
      const { registerToolbarAction } = useThreeDHopViewer();
      React.useEffect(
        () =>
          registerToolbarAction('custom-action', (_p, action) => {
            received.push(action);
            return true;
          }),
        [registerToolbarAction]
      );
      return null;
    }

    const { container } = render(
      <ViewerHarness presenter={presenter} controlsRef={{ current: null }}>
        <Registrar />
        {/* Deliberately not inside any `<Toolbar>`/`#toolbar` markup - that's the whole point. */}
        <DispatchButton action="custom-action" />
      </ViewerHarness>
    );

    act(() => {
      fireEvent.click(container.querySelector('button')!);
    });

    expect(received).toEqual(['custom-action']);
  });

  it('is a no-op for an action with no registered handler and no presenter', () => {
    const { container } = render(
      <ViewerHarness presenter={null} controlsRef={{ current: null }}>
        <DispatchButton action="nothing-registered" />
      </ViewerHarness>
    );

    expect(() => {
      act(() => {
        fireEvent.click(container.querySelector('button')!);
      });
    }).not.toThrow();
  });
});
