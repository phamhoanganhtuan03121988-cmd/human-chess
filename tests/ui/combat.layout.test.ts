import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/*
 * jsdom cannot lay out or evaluate media queries, so these guard the CSS
 * rules that keep the combat scene inside a phone's viewport (verified in a
 * real browser at 390×600 and 375×553 portrait, where the cards used to sit
 * side by side and the defender left the screen).
 */
const css = readFileSync('src/styles.css', 'utf8');
const rule = (selector: string, from = 0) => {
  const start = css.indexOf(`${selector} {`, from);
  expect(start, selector).toBeGreaterThanOrEqual(0);
  return css.slice(start, css.indexOf('}', start));
};

describe('combat overlay responsive layout', () => {
  it('puts the cards side by side only on short landscape screens, never on a portrait phone', () => {
    const queries = [...css.matchAll(/@media ([^{]+)\{\s*\.combat-overlay__stage \{/g)].map((m) => m[1]!.trim());
    expect(queries).toEqual(['(max-height: 640px) and (orientation: landscape)']);
    const row = rule('.combat-overlay__stage', css.indexOf(queries[0]!));
    expect(row).toContain('flex-direction: row');
  });

  it('caps the card height by the available width in both layouts', () => {
    const base = rule('.combat-overlay__stage');
    expect(base).toContain('flex-direction: column');
    expect(base).toMatch(/--card-h: min\(.*var\(--stage-w\).*\)/);
    const row = rule('.combat-overlay__stage', css.indexOf('(orientation: landscape) {'));
    expect(row).toMatch(/--card-h: min\(.*var\(--stage-w\).*\)/);
  });

  it('keeps clear of the notch and home indicator', () => {
    const overlay = rule('.combat-overlay');
    for (const side of ['top', 'right', 'bottom', 'left']) expect(overlay).toContain(`env(safe-area-inset-${side}`);
  });
});
