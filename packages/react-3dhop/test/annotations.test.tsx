// @vitest-environment jsdom
import React from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Annotations, type AnnotationDefinition } from '../src/Annotations.js';
import { createMockPresenter, type MockPresenter } from './mockPresenter.js';
import { ViewerHarness, type HarnessControls } from './harness.js';

function mount(
  presenter: MockPresenter,
  registerSceneContribution: (key: string, contribution: unknown) => () => void,
  updateSceneContribution: (key: string, contribution: unknown) => void,
  annotations?: AnnotationDefinition[]
) {
  const controls: React.MutableRefObject<HarnessControls | null> = { current: null };
  const utils = render(
    <ViewerHarness
      presenter={presenter}
      controlsRef={controls}
      registerSceneContribution={registerSceneContribution as never}
      updateSceneContribution={updateSceneContribution as never}
    >
      <Annotations annotations={annotations} expanded />
    </ViewerHarness>
  );
  const rerenderWith = (nextPresenter: MockPresenter, nextAnnotations?: AnnotationDefinition[]) =>
    utils.rerender(
      <ViewerHarness
        presenter={nextPresenter}
        controlsRef={controls}
        registerSceneContribution={registerSceneContribution as never}
        updateSceneContribution={updateSceneContribution as never}
      >
        <Annotations annotations={nextAnnotations} expanded />
      </ViewerHarness>
    );
  return { ...utils, rerenderWith };
}

const ONE_SPOT: AnnotationDefinition[] = [{ id: 'a', position: [1, 2, 3], color: [1, 0, 0], label: 'A spot' }];

describe('Annotations', () => {
  it('does not re-register the scene contribution when a new-but-equal annotations array arrives', () => {
    const registerSceneContribution = vi.fn((_key: string, _contribution: unknown) => () => {});
    const updateSceneContribution = vi.fn();
    const presenter = createMockPresenter();
    const { rerenderWith } = mount(presenter, registerSceneContribution, updateSceneContribution, ONE_SPOT);
    const registerCallsAfterMount = registerSceneContribution.mock.calls.length;
    expect(registerCallsAfterMount).toBeGreaterThan(0);

    // A fresh array with identical content, as an inline `.map()` in a consumer's render would
    // produce on every unrelated state update - this used to force a full scene reload.
    rerenderWith(presenter, [{ id: 'a', position: [1, 2, 3], color: [1, 0, 0], label: 'A spot' }]);

    expect(registerSceneContribution.mock.calls.length).toBe(registerCallsAfterMount);
  });

  it('patches an existing spot in place instead of forcing a full scene reload', () => {
    const registerSceneContribution = vi.fn((_key: string, _contribution: unknown) => () => {});
    const updateSceneContribution = vi.fn();
    // Seed the presenter's live scene with the spot a real `setScene` would already have created
    // for the initial render, the way it would be by the time a user drags a colour picker.
    const presenter = createMockPresenter({
      spots: { a: { mesh: 'spot', color: [1, 0, 0], alpha: 0.5, alphaHigh: 0.8, transform: { matrix: [] } } }
    });
    const { rerenderWith } = mount(presenter, registerSceneContribution, updateSceneContribution, ONE_SPOT);
    const registerCallsAfterMount = registerSceneContribution.mock.calls.length;

    rerenderWith(presenter, [{ id: 'a', position: [1, 2, 3], color: [0, 1, 0], label: 'A spot' }]);

    // Same id set, same mesh - no new/removed registration, just a registry sync.
    expect(registerSceneContribution.mock.calls.length).toBe(registerCallsAfterMount);
    expect(updateSceneContribution).toHaveBeenCalled();

    // The live spot's colour was patched directly rather than waiting for a scene rebuild.
    expect(presenter._scene.spots!.a.color).toEqual([0, 1, 0]);
    expect(presenter.repaint).toHaveBeenCalled();
    expect(presenter.setScene).not.toHaveBeenCalled();
  });

  it('still does a full re-registration when a spot is added', () => {
    const registerSceneContribution = vi.fn((_key: string, _contribution: unknown) => () => {});
    const updateSceneContribution = vi.fn();
    const presenter = createMockPresenter({
      spots: { a: { mesh: 'spot', color: [1, 0, 0], alpha: 0.5, alphaHigh: 0.8, transform: { matrix: [] } } }
    });
    const { rerenderWith } = mount(presenter, registerSceneContribution, updateSceneContribution, ONE_SPOT);
    const registerCallsAfterMount = registerSceneContribution.mock.calls.length;

    rerenderWith(presenter, [
      ...ONE_SPOT,
      { id: 'b', position: [4, 5, 6], color: [0, 0, 1], label: 'A second spot' }
    ]);

    expect(registerSceneContribution.mock.calls.length).toBe(registerCallsAfterMount + 1);
  });

  it('still does a full re-registration when a spot is removed', () => {
    const registerSceneContribution = vi.fn((_key: string, _contribution: unknown) => () => {});
    const updateSceneContribution = vi.fn();
    const presenter = createMockPresenter({
      spots: { a: { mesh: 'spot', color: [1, 0, 0], alpha: 0.5, alphaHigh: 0.8, transform: { matrix: [] } } }
    });
    const { rerenderWith } = mount(presenter, registerSceneContribution, updateSceneContribution, ONE_SPOT);
    const registerCallsAfterMount = registerSceneContribution.mock.calls.length;

    rerenderWith(presenter, []);

    expect(registerSceneContribution.mock.calls.length).toBe(registerCallsAfterMount + 1);
  });
});
