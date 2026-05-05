import { test } from 'node:test';
import assert from 'node:assert/strict';

import { renderItemSparkline } from './sparkline.js';

test('renderItemSparkline returns empty string for short series', () => {
  assert.equal(renderItemSparkline(null), '');
  assert.equal(renderItemSparkline([]), '');
  assert.equal(renderItemSparkline([1]), '');
});

test('renderItemSparkline emits an SVG polyline for ≥2 points', () => {
  const svg = renderItemSparkline([1, 2, 3, 4]);
  assert.match(svg, /<svg /);
  assert.match(svg, /<polyline points="/);
  assert.match(svg, /viewBox="0 0 120 28"/);
});
