// @vitest-environment jsdom
import React from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CubeNavigation } from '../src/CubeNavigation.js';
import { createMockPresenter, type MockPresenter } from './mockPresenter.js';
import { ViewerHarness, type HarnessControls } from './harness.js';

function mount(presenter: MockPresenter, ui: React.ReactNode) {
  const controls: React.MutableRefObject<HarnessControls | null> = { current: null };
  return render(
    <ViewerHarness presenter={presenter} controlsRef={controls}>
      {ui}
    </ViewerHarness>
  );
}

// This project runs without RTL's auto-cleanup between tests (see triggerToolbarAction.test.tsx),
// so every query below is scoped to this render's own `container` rather than the global
// `getByText`/`queryByText` (bound to `document.body`, which would see every prior test's DOM too).
describe('CubeNavigation', () => {
  it('renders the Home button, projection toggle, and edge controls by default', () => {
    const { container } = mount(createMockPresenter(), <CubeNavigation />);
    const actionButtons = container.querySelectorAll('.cube-navigation-actions button');
    expect(Array.from(actionButtons).map((b) => b.textContent)).toEqual(['Home', 'Orthographic']);
    expect(container.querySelectorAll('.cube-navigation-face-edge').length).toBe(24); // 4 edges x 6 faces
  });

  it('hides the Home button without touching the projection toggle', () => {
    const { container } = mount(createMockPresenter(), <CubeNavigation showHomeButton={false} />);
    const actionButtons = container.querySelectorAll('.cube-navigation-actions button');
    expect(Array.from(actionButtons).map((b) => b.textContent)).toEqual(['Orthographic']);
  });

  it('omits the actions row entirely when both the Home button and projection toggle are off', () => {
    const { container } = mount(
      createMockPresenter(),
      <CubeNavigation showHomeButton={false} showProjectionToggle={false} />
    );
    expect(container.querySelector('.cube-navigation-actions')).toBeNull();
  });

  it('drops the per-face edge-rotation strips when asked, leaving whole-face clicks intact', () => {
    const { container } = mount(createMockPresenter(), <CubeNavigation showEdgeControls={false} />);
    expect(container.querySelectorAll('.cube-navigation-face-edge').length).toBe(0);
    expect(container.querySelectorAll('.cube-navigation-face').length).toBe(6);
  });

  it('renders a ReactNode face label as-is and falls back to the English name for aria-label', () => {
    const { container } = mount(
      createMockPresenter(),
      <CubeNavigation labels={{ front: <i className="bi bi-circle-fill" /> }} />
    );
    const front = container.querySelector('.cube-navigation-face-front')!;
    expect(front.querySelector('i.bi-circle-fill')).not.toBeNull();
    expect(front.getAttribute('aria-label')).toBe('Front');
  });

  it('still uses a string face label as both the visible text and the aria-label (unchanged behaviour)', () => {
    const { container } = mount(createMockPresenter(), <CubeNavigation labels={{ front: 'Forside' }} />);
    const front = container.querySelector('.cube-navigation-face-front')!;
    // The face also contains the 4 edge-rotation buttons; the label lives in its own first child.
    expect(front.firstElementChild?.textContent).toBe('Forside');
    expect(front.getAttribute('aria-label')).toBe('Forside');
  });

  it('merges panelStyle onto the panel, e.g. to strip the default background for a bare cube', () => {
    const { container } = mount(
      createMockPresenter(),
      <CubeNavigation panelStyle={{ background: 'none', boxShadow: 'none', padding: 0 }} />
    );
    const panel = container.querySelector('.cube-navigation-panel') as HTMLElement;
    expect(panel.style.background).toBe('none');
    expect(panel.style.boxShadow).toBe('none');
    expect(panel.style.padding).toBe('0px');
  });

  it('merges faceStyle onto every face uniformly, e.g. for a theme-specific colour', () => {
    const { container } = mount(
      createMockPresenter(),
      <CubeNavigation faceStyle={{ background: '#696968', color: '#d8d8d8' }} />
    );
    const faces = container.querySelectorAll('.cube-navigation-face') as NodeListOf<HTMLElement>;
    expect(faces.length).toBe(6);
    faces.forEach((face) => {
      expect(face.style.background).toBe('rgb(105, 105, 104)');
      expect(face.style.color).toBe('rgb(216, 216, 216)');
    });
  });
});
