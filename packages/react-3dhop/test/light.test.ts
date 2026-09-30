import { describe, expect, it } from 'vitest';
import {
  discToLightDirection,
  discToPixel,
  discToRotateLightArgs,
  lightDirectionToDisc,
  pixelToDisc
} from '../src/geometry/light.js';

describe('light disc mapping', () => {
  it('maps the default head-on light to the disc centre', () => {
    expect(lightDirectionToDisc([0, 0, -1])).toEqual([0, 0]);
    expect(lightDirectionToDisc(null)).toEqual([0, 0]);
  });

  it('round-trips a disc point through 3DHOP\'s rotateLight convention', () => {
    const p: [number, number] = [0.2, -0.3];
    const dir = discToLightDirection(p);
    expect(lightDirectionToDisc(dir)[0]).toBeCloseTo(p[0]);
    expect(lightDirectionToDisc(dir)[1]).toBeCloseTo(p[1]);
  });

  it('flips y for rotateLight (screen y is down)', () => {
    expect(discToRotateLightArgs([0.2, 0.3])).toEqual([0.2, -0.3]);
  });

  it('clamps points outside the unit circle to the rim', () => {
    const dir = discToLightDirection([0.5, 0.5]);
    expect(Math.hypot(dir[0], dir[1])).toBeCloseTo(1, 5);
    expect(dir[2]).toBeCloseTo(-Math.sqrt(1 - 0.999 ** 2));
  });
});

describe('pixel <-> disc', () => {
  const size = 126;
  const radius = 60;

  it('centre pixel is the disc origin', () => {
    expect(pixelToDisc(63, 63, size, radius)).toEqual([0, 0]);
  });

  it('a point at half the radius maps to 0.25', () => {
    const p = pixelToDisc(63 + 30, 63, size, radius)!;
    expect(p[0]).toBeCloseTo(0.25);
    expect(p[1]).toBeCloseTo(0);
  });

  it('rejects the rim dead zone and outside', () => {
    expect(pixelToDisc(63 + 56, 63, size, radius)).toBeNull();
    expect(pixelToDisc(0, 0, size, radius)).toBeNull();
    expect(pixelToDisc(63 + 54, 63, size, radius)).not.toBeNull();
  });

  it('discToPixel inverts pixelToDisc', () => {
    const p = pixelToDisc(80, 40, size, radius)!;
    const [x, y] = discToPixel(p, size, radius);
    expect(x).toBeCloseTo(80);
    expect(y).toBeCloseTo(40);
  });
});
