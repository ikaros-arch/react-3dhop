// @vitest-environment jsdom
import React from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ThreeDHopViewer } from '../src/ThreeDHopViewer.js';
import { Toolbar, HomeControl, MeasureControl } from '../src/Toolbar.js';

describe('ThreeDHopViewer toolbar resolution', () => {
  it('renders the built-in default toolbar, correctly asset-pathed, when none is provided', () => {
    const { container } = render(<ThreeDHopViewer assetBaseUrl="/3dhop" />);
    const home = container.querySelector<HTMLImageElement>('[data-hop-id="home"]');
    expect(home?.src).toContain('/3dhop/skins/dark/home.png');
  });

  it('suppresses the default toolbar and resolves icons correctly for a direct <Toolbar> child', () => {
    const { container, queryAllByText } = render(
      <ThreeDHopViewer assetBaseUrl="/3dhop">
        <Toolbar>
          <MeasureControl label="Measured length" />
        </Toolbar>
      </ThreeDHopViewer>
    );
    expect(container.querySelector('[data-hop-id="home"]')).toBeNull();
    const measure = container.querySelector<HTMLImageElement>('[data-hop-id="measure"]');
    expect(measure?.src).toContain('/3dhop/skins/dark/measure.png');
    expect(queryAllByText('Measured length').length).toBeGreaterThan(0);
  });

  it('a <Toolbar> hidden inside a wrapper element is NOT detected as the toolbar (documents the limit)', () => {
    const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => <div>{children}</div>;
    const { container } = render(
      <ThreeDHopViewer assetBaseUrl="/3dhop">
        <Wrapper>
          <Toolbar>
            <MeasureControl label="Measured length" />
          </Toolbar>
        </Wrapper>
      </ThreeDHopViewer>
    );
    // The default toolbar still renders, because a wrapped <Toolbar> can't be seen by type...
    expect(container.querySelector('[data-hop-id="home"]')).not.toBeNull();
    // ...but the wrapped toolbar's own icon still resolves correctly, since ToolbarAssetsProvider
    // now wraps every child, not just the ones ThreeDHopViewer classified as "the toolbar".
    const measure = container.querySelector<HTMLImageElement>('[data-hop-id="measure"]');
    expect(measure?.src).toContain('/3dhop/skins/dark/measure.png');
  });

  it('an explicit `toolbar` prop wins even when the real toolbar is wrapped in children', () => {
    const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => <div>{children}</div>;
    const toolbar = (
      <Toolbar>
        <HomeControl />
        <MeasureControl label="Measured length" />
      </Toolbar>
    );
    const { container } = render(
      <ThreeDHopViewer assetBaseUrl="/3dhop" toolbar={toolbar}>
        <Wrapper>
          <Toolbar>
            <MeasureControl label="should not render" />
          </Toolbar>
        </Wrapper>
      </ThreeDHopViewer>
    );

    // Only the explicit toolbar prop's controls render inside the toolbar container...
    const toolbarContainer = container.querySelector('[data-hop-toolbar-container="true"]');
    expect(toolbarContainer?.querySelector('[data-hop-id="home"]')).not.toBeNull();
    // ...the wrapped children-based <Toolbar> is treated as ordinary content, not a second toolbar.
    expect(container.querySelectorAll('[data-hop-toolbar-container="true"]')).toHaveLength(1);
  });

  it('renders a ReactNode `icon` on a BasicControlProps control as its own element, not an <img>', () => {
    const { container } = render(
      <ThreeDHopViewer assetBaseUrl="/3dhop">
        <Toolbar>
          <HomeControl icon={<i className="bi bi-house-fill" />} />
        </Toolbar>
      </ThreeDHopViewer>
    );
    const home = container.querySelector('[data-hop-id="home"]');
    expect(home).not.toBeNull();
    expect(home?.tagName).not.toBe('IMG');
    expect(home?.querySelector('i.bi-house-fill')).not.toBeNull();
  });

  it('renders a ReactNode `icon` on a ToggleIcons control (both pair members) as non-<img> elements', () => {
    const { container } = render(
      <ThreeDHopViewer assetBaseUrl="/3dhop">
        <Toolbar>
          <MeasureControl
            label="Measured length"
            icon={{ enabled: <i className="bi bi-rulers" />, disabled: <i className="bi bi-rulers" /> }}
          />
        </Toolbar>
      </ThreeDHopViewer>
    );
    const measure = container.querySelector('[data-hop-id="measure"]');
    const measureOn = container.querySelector('[data-hop-id="measure_on"]');
    expect(measure?.tagName).not.toBe('IMG');
    expect(measureOn?.tagName).not.toBe('IMG');
    expect(measure?.querySelector('i.bi-rulers')).not.toBeNull();
    expect(measureOn?.querySelector('i.bi-rulers')).not.toBeNull();
  });

  it('still resolves a string `icon` to the legacy <img> markup (backward compatible)', () => {
    const { container } = render(
      <ThreeDHopViewer assetBaseUrl="/3dhop">
        <Toolbar>
          <HomeControl icon="/custom/home.png" />
        </Toolbar>
      </ThreeDHopViewer>
    );
    const home = container.querySelector<HTMLImageElement>('[data-hop-id="home"]');
    expect(home?.tagName).toBe('IMG');
    expect(home?.src).toContain('/custom/home.png');
  });
});
