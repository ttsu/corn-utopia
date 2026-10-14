import { describe, expect, it } from 'vitest';
import { labelOffset, powerButtonArc, type ArcSpot } from './powerButtons';

const DASH_SIZE = 96;

function center(spot: ArcSpot): { x: number; y: number } {
  return { x: spot.x + spot.size / 2, y: spot.y + spot.size / 2 };
}

/** Circumcenter of three points. */
function circle(a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }) {
  const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
  const x = ((a.x ** 2 + a.y ** 2) * (b.y - c.y) + (b.x ** 2 + b.y ** 2) * (c.y - a.y) + (c.x ** 2 + c.y ** 2) * (a.y - b.y)) / d;
  const y = ((a.x ** 2 + a.y ** 2) * (c.x - b.x) + (b.x ** 2 + b.y ** 2) * (a.x - c.x) + (c.x ** 2 + c.y ** 2) * (b.x - a.x)) / d;
  return { x, y, r: Math.hypot(x - a.x, y - a.y) };
}

describe('power button arc', () => {
  const spots = powerButtonArc();
  const centers = spots.map(center);
  const dash = { x: DASH_SIZE / 2, y: DASH_SIZE / 2 };

  it('puts every power on one circle, with equal steps', () => {
    expect(spots).toHaveLength(4);
    const arc = circle(centers[0], centers[1], centers[2]);
    for (const c of centers) {
      expect(Math.hypot(c.x - arc.x, c.y - arc.y)).toBeCloseTo(arc.r, 4);
    }
    const angles = centers.map((c) => Math.atan2(c.y - arc.y, c.x - arc.x));
    const steps: number[] = [];
    for (let i = 1; i < angles.length; i++) {
      let step = angles[i] - angles[i - 1];
      if (step < -Math.PI) step += Math.PI * 2;
      if (step > Math.PI) step -= Math.PI * 2;
      steps.push(step);
    }
    for (const step of steps) expect(step).toBeCloseTo(steps[0], 5);
    const edgeGap = Math.hypot(centers[1].x - centers[0].x, centers[1].y - centers[0].y) - spots[0].size;
    expect(edgeGap).toBeGreaterThan(8);
  });

  it('bows around the dash instead of stacking beside it', () => {
    const arc = circle(centers[0], centers[1], centers[2]);
    // The dash sits inside the circle the buttons ride on, so the arc wraps it.
    expect(Math.hypot(dash.x - arc.x, dash.y - arc.y)).toBeLessThan(arc.r);
    for (const c of centers) {
      const clearance = Math.hypot(c.x - dash.x, c.y - dash.y) - DASH_SIZE / 2 - spots[0].size / 2;
      expect(clearance).toBeGreaterThan(8);
    }
    // First place is left of the dash; last place is above it. The middle bows out.
    expect(centers[0].x).toBeGreaterThan(dash.x + 40);
    expect(centers[0].y).toBeCloseTo(dash.y, 0);
    expect(centers[3].y).toBeGreaterThan(dash.y + 40);
    expect(centers[3].x).toBeCloseTo(dash.x, 0);
    const mid = centers[1];
    const flank = Math.hypot(centers[0].x - dash.x, centers[0].y - dash.y);
    expect(Math.hypot(mid.x - dash.x, mid.y - dash.y)).toBeGreaterThan(flank + 20);
  });

  it('mirrors across the diagonal, and stays in the corner', () => {
    for (let i = 0; i < spots.length; i++) {
      const a = centers[i];
      const b = centers[spots.length - 1 - i];
      expect(a.x).toBeCloseTo(b.y, 4);
      expect(a.y).toBeCloseTo(b.x, 4);
      expect(spots[i].x).toBeGreaterThanOrEqual(0);
      expect(spots[i].y).toBeGreaterThanOrEqual(0);
    }
  });

  it('puts the name on the outer side of the button', () => {
    for (const spot of spots) {
      const offset = labelOffset(spot.angle, spot.size);
      const outwardX = -Math.cos(spot.angle);
      const outwardY = -Math.sin(spot.angle);
      expect(offset.x * outwardX + offset.y * outwardY).toBeGreaterThan(spot.size / 2);
    }
  });
});
