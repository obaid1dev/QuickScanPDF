// Run with: node --test scripts/contrast.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseColor, composite, relativeLuminance, contrastRatio } from './contrast.mjs';

const near = (actual, expected, tolerance) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `expected ~${expected}, got ${actual}`);

// What the CLI does: composite the foreground over the background, then measure.
const measure = (fg, bg) => {
  const surface = parseColor(bg);
  return contrastRatio(composite(parseColor(fg), surface), surface);
};

test('parseColor reads every syntax React Native accepts', () => {
  assert.deepEqual(parseColor('#fff'), { r: 255, g: 255, b: 255, a: 1 });
  assert.deepEqual(parseColor('#1C1C1E'), { r: 28, g: 28, b: 30, a: 1 });
  assert.deepEqual(parseColor('#00000080'), { r: 0, g: 0, b: 0, a: 128 / 255 });
  assert.deepEqual(parseColor('rgba(255, 255, 255, 0.6)'), { r: 255, g: 255, b: 255, a: 0.6 });
  assert.deepEqual(parseColor('rgb(255 0 255 / 50%)'), { r: 255, g: 0, b: 255, a: 0.5 });
  assert.deepEqual(parseColor('hsl(0, 100%, 50%)'), { r: 255, g: 0, b: 0, a: 1 });
  // Named colors aren't supported on purpose: tokens should be hex anyway.
  assert.equal(parseColor('red'), null);
});

test('composite blends alpha over the background', () => {
  const seen = composite(parseColor('rgba(255,255,255,0.38)'), parseColor('#1C1C1E'));
  assert.deepEqual(seen, { r: 114, g: 114, b: 116, a: 1 });
});

// ─── Luminance and contrast ───────────────────────────────────────────────────

test('relativeLuminance: white is 1, black is 0', () => {
  near(relativeLuminance({ r: 255, g: 255, b: 255 }), 1, 1e-9);
  near(relativeLuminance({ r: 0, g: 0, b: 0 }), 0, 1e-9);
});

test('relativeLuminance: #1C1C1E matches the hand trace', () => {
  near(relativeLuminance({ r: 28, g: 28, b: 30 }), 0.0117, 0.0001);
});

test('relativeLuminance: very dark channels use the linear branch', () => {
  // 10 / 255 = 0.039 is below 0.04045, so it takes the c / 12.92 branch.
  near(relativeLuminance({ r: 10, g: 10, b: 10 }), 0.00304, 0.00001);
});

test('contrastRatio: extremes', () => {
  near(contrastRatio({ r: 255, g: 255, b: 255 }, { r: 0, g: 0, b: 0 }), 21, 1e-9);
  near(contrastRatio({ r: 28, g: 28, b: 30 }, { r: 28, g: 28, b: 30 }), 1, 1e-9);
});

test('contrastRatio: argument order does not matter', () => {
  const teal = parseColor('#2DD4BF');
  const night = parseColor('#0C1219');
  assert.equal(contrastRatio(teal, night), contrastRatio(night, teal));
});

test('reference values published in references/color-system.md', () => {
  near(measure('rgba(255,255,255,0.87)', '#1C1C1E'), 13.02, 0.01);
  near(measure('rgba(255,255,255,0.60)', '#1C1C1E'), 6.83, 0.01);
  near(measure('rgba(255,255,255,0.38)', '#1C1C1E'), 3.54, 0.01);
  near(measure('#2DD4BF', '#0C1219'), 10.1, 0.01);
  near(measure('#64748B', '#0C1219'), 3.95, 0.01);
  near(measure('rgba(60,60,67,0.6)', '#FFFFFF'), 3.43, 0.01);
});
