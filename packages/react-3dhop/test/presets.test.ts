import { describe, expect, it } from 'vitest';
import { VIEW_PRESETS, clampTheta, normalizeAngle, toPresenterTrackballState, toTrackballState, viewPresetState } from '../src/geometry/presets.js';

const current: [number, number, number, number, number, number] = [35, 15, 0.1, 0.2, 0.3, 2.5];

describe('angle helpers', () => {
  it('normalizes into [0, 360)', () => {
    expect(normalizeAngle(370)).toBe(10);
    expect(normalizeAngle(-90)).toBe(270);
    expect(normalizeAngle(NaN)).toBe(0);
  });
  it('clamps theta to ±90', () => {
    expect(clampTheta(120)).toBe(90);
    expect(clampTheta(-120)).toBe(-90);
    expect(clampTheta(Infinity)).toBe(0);
  });
});

describe('toTrackballState', () => {
  it('fills gaps and ignores garbage', () => {
    expect(toTrackballState([1, 2], current)).toEqual([1, 2, 0.1, 0.2, 0.3, 2.5]);
    expect(toTrackballState([NaN, 5, 0, 0, 0, 1, 99], current)).toEqual([35, 5, 0, 0, 0, 1]);
    expect(toTrackballState(undefined, current)).toEqual(current);
  });

  it('widens the plain turntable\'s [phi, theta, distance] into the six-value form', () => {
    expect(toTrackballState([35, 15, 2.5], current)).toEqual([35, 15, 0, 0, 0, 2.5]);
  });
});

describe('toPresenterTrackballState', () => {
  it('returns three values when the presenter reported three', () => {
    expect(toPresenterTrackballState([0, 90, 0.1, 0.2, 0.3, 2.5], [35, 15, 2.5])).toEqual([0, 90, 2.5]);
  });
  it('keeps six values otherwise', () => {
    expect(toPresenterTrackballState([0, 90, 0.1, 0.2, 0.3, 2.5], [35, 15, 0, 0, 0, 2.5])).toEqual([0, 90, 0.1, 0.2, 0.3, 2.5]);
    expect(toPresenterTrackballState([0, 90, 0.1, 0.2, 0.3, 2.5], null)).toEqual([0, 90, 0.1, 0.2, 0.3, 2.5]);
  });
});

describe('viewPresetState', () => {
  it('applies a named preset and keeps pan/distance by default', () => {
    expect(viewPresetState('top', current)).toEqual([0, 90, 0.1, 0.2, 0.3, 2.5]);
    expect(viewPresetState('left', current)).toEqual([270, 0, 0.1, 0.2, 0.3, 2.5]);
  });

  it('recentres and uses targetDistance when not preserving', () => {
    expect(viewPresetState('front', current, { preservePanAndDistance: false, targetDistance: 1.3 })).toEqual([0, 0, 0, 0, 0, 1.3]);
  });

  it('accepts a partial state, normalising angles', () => {
    expect(viewPresetState({ phi: -45, theta: 200 }, current)).toEqual([315, 90, 0.1, 0.2, 0.3, 2.5]);
    expect(viewPresetState({ distance: 4 }, current)).toEqual([35, 15, 0.1, 0.2, 0.3, 4]);
  });

  it('covers all six presets', () => {
    expect(Object.keys(VIEW_PRESETS).sort()).toEqual(['back', 'bottom', 'front', 'left', 'right', 'top']);
  });
});
