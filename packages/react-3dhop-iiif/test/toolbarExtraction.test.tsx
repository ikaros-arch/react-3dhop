// @vitest-environment jsdom
import React from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Toolbar, HomeControl, MeasureControl } from '@ikaros-arch/react-3dhop';
import { IIIFViewer } from '../src/IIIFViewer.js';
import astronaut from './fixtures/astronaut.json' with { type: 'json' };
import type { IIIFManifest } from '../src/iiif/types.js';

/**
 * Regression test for a real bug found while integrating this package into a consuming app:
 * `<IIIFProvider>` has to sit between `<ThreeDHopViewer>` and the caller's children (it needs
 * `useThreeDHopViewer()`), which used to hide any `<Toolbar>` child from `ThreeDHopViewer`'s
 * by-type detection — every custom toolbar silently fell back to the built-in default, with none
 * of its own controls' icons resolving against `assetBaseUrl`. Fixed via `extractToolbar()` +
 * `ThreeDHopViewer`'s new `toolbar` prop (see `packages/react-3dhop/test/toolbarProp.test.tsx`).
 */
describe('IIIFViewer toolbar extraction', () => {
  it('forwards a <Toolbar> child to ThreeDHopViewer via the toolbar prop', () => {
    const { container } = render(
      <IIIFViewer manifest={astronaut as IIIFManifest} assetBaseUrl="/3dhop">
        <Toolbar>
          <HomeControl />
          <MeasureControl label="Measured length" />
        </Toolbar>
      </IIIFViewer>
    );

    // Exactly one toolbar container — not the default plus a second, broken one.
    expect(container.querySelectorAll('[data-hop-toolbar-container="true"]')).toHaveLength(1);

    const home = container.querySelector<HTMLImageElement>('[data-hop-id="home"]');
    const measure = container.querySelector<HTMLImageElement>('[data-hop-id="measure"]');
    expect(home?.src).toContain('/3dhop/skins/dark/home.png');
    expect(measure?.src).toContain('/3dhop/skins/dark/measure.png');
  });

  it('falls back to the built-in default toolbar when no children are given', () => {
    const { container } = render(<IIIFViewer manifest={astronaut as IIIFManifest} assetBaseUrl="/3dhop" />);
    expect(container.querySelector('[data-hop-id="home"]')).not.toBeNull();
  });

  it('an explicit `toolbar` prop is not overwritten by (the absence of) one in children', () => {
    // Covers a caller who, in turn, wraps their own toolbar in a component of their own — the same
    // problem this fix solves for IIIFProvider, one level further out.
    const { container } = render(
      <IIIFViewer
        manifest={astronaut as IIIFManifest}
        assetBaseUrl="/3dhop"
        toolbar={
          <Toolbar>
            <MeasureControl label="Measured length" />
          </Toolbar>
        }
      >
        <div>not a toolbar</div>
      </IIIFViewer>
    );

    expect(container.querySelectorAll('[data-hop-toolbar-container="true"]')).toHaveLength(1);
    const measure = container.querySelector<HTMLImageElement>('[data-hop-id="measure"]');
    expect(measure?.src).toContain('/3dhop/skins/dark/measure.png');
  });
});
