#!/usr/bin/env node
// Measures WCAG 2.x contrast between a foreground and a background color.
//
//   node scripts/contrast.mjs <foreground> <background>
//
// Accepts #rgb, #rgba, #rrggbb, #rrggbbaa, rgb(), rgba(), hsl() and hsla().
// A foreground with alpha is composited over the background first, so the
// ratio is the one the user actually sees. The background must be opaque:
// it's the surface the text sits on.

import { pathToFileURL } from 'node:url';

// WCAG AA minimums. "Large" is >= 24 regular or >= 19 bold, in RN units.
const AA = { body: 4.5, large: 3, ui: 3 };

/** Parses a color string into { r, g, b, a } (channels 0-255, alpha 0-1). Returns null if unsupported. */
export function parseColor(input) {
  const s = input.trim().toLowerCase();

  const hex = s.match(/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/);
  if (hex) {
    let h = hex[1];
    if (h.length <= 4) h = [...h].map((c) => c + c).join('');
    const byte = (i) => parseInt(h.slice(i, i + 2), 16);
    return { r: byte(0), g: byte(2), b: byte(4), a: h.length === 8 ? byte(6) / 255 : 1 };
  }

  // Both syntaxes RN accepts: rgba(255, 0, 255, 0.5) and rgba(255 0 255 / 0.5)
  const rgb = s.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/);
  if (rgb) {
    return { r: Number(rgb[1]), g: Number(rgb[2]), b: Number(rgb[3]), a: parseAlpha(rgb[4]) };
  }

  const hsl = s.match(/^hsla?\(\s*([\d.]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/);
  if (hsl) {
    return { ...hslToRgb(Number(hsl[1]), Number(hsl[2]) / 100, Number(hsl[3]) / 100), a: parseAlpha(hsl[4]) };
  }

  return null;
}

function parseAlpha(raw) {
  if (raw === undefined) return 1;
  return raw.endsWith('%') ? parseFloat(raw) / 100 : parseFloat(raw);
}

// Standard HSL → RGB conversion (CSS Color 4).
function hslToRgb(hue, saturation, lightness) {
  const k = (n) => (n + (hue % 360) / 30) % 12;
  const chroma = saturation * Math.min(lightness, 1 - lightness);
  const channel = (n) => lightness - chroma * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return { r: Math.round(channel(0) * 255), g: Math.round(channel(8) * 255), b: Math.round(channel(4) * 255) };
}

/** Blends a semi-transparent foreground over an opaque background: the color that actually reaches the screen. */
export function composite(fg, bg) {
  const mix = (f, b) => Math.round(fg.a * f + (1 - fg.a) * b);
  return { r: mix(fg.r, bg.r), g: mix(fg.g, bg.g), b: mix(fg.b, bg.b), a: 1 };
}

/**
 * WCAG relative luminance of an opaque color: 0 for black, 1 for white.
 * Hex values are gamma-encoded, not light. Each channel is linearized first,
 * then weighted by how sensitive the eye is to it (green the most).
 */
export function relativeLuminance({ r, g, b }) {
  const toLinear = (channel) => {
    const c = channel / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/** WCAG contrast ratio between two opaque colors, from 1 to 21. Order doesn't matter. */
export function contrastRatio(a, b) {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// ─── CLI ──────────────────────────────────────────────────────────────────────

const toHex = ({ r, g, b }) =>
  '#' + [r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('').toUpperCase();

function main(args) {
  if (args.length !== 2) {
    console.error('Usage: node scripts/contrast.mjs <foreground> <background>');
    process.exit(2);
  }

  const [fgInput, bgInput] = args;
  const fg = parseColor(fgInput);
  const bg = parseColor(bgInput);
  if (!fg || !bg) {
    console.error(`Unsupported color: ${fg ? bgInput : fgInput}. Use #hex, rgb(), rgba(), hsl() or hsla().`);
    process.exit(2);
  }
  if (bg.a < 1) {
    console.error('The background must be opaque: it is the surface the text sits on.');
    process.exit(2);
  }

  const seen = composite(fg, bg);
  const ratio = contrastRatio(seen, bg);
  // WCAG doesn't round up: 4.499 fails 4.5. Truncate the display so it never shows a pass that isn't one.
  const shown = Math.floor(ratio * 100) / 100;
  const verdict = (min) => `${ratio >= min ? 'PASS' : 'FAIL'} (needs ${min}:1)`;

  console.log(`${fgInput} on ${bgInput}${fg.a < 1 ? `  (seen as ${toHex(seen)})` : ''}`);
  console.log(`${shown.toFixed(2)}:1`);
  console.log(`  body text   ${verdict(AA.body)}`);
  console.log(`  large text  ${verdict(AA.large)}`);
  console.log(`  UI / icons  ${verdict(AA.ui)}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2));
}
