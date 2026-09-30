import { readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MUSIC_TRACK_URL } from '../src/audio/music.ts';

describe('background music asset', () => {
  const path = `public${MUSIC_TRACK_URL}`;

  it('is shipped at the path the music layer loads', () => {
    expect(MUSIC_TRACK_URL).toBe('/assets/audio/xiangqi-theme.mp3');
    expect(statSync(path).size).toBeGreaterThan(1_000_000);
  });

  it('is a real MP3 (ID3 tag followed by MPEG audio frames)', () => {
    const bytes = readFileSync(path);
    expect(bytes.subarray(0, 3).toString('latin1')).toBe('ID3');
    // ID3v2 size is a 28-bit syncsafe integer; the first MPEG frame follows the tag.
    const tagSize = ((bytes[6]! & 0x7f) << 21) | ((bytes[7]! & 0x7f) << 14) | ((bytes[8]! & 0x7f) << 7) | (bytes[9]! & 0x7f);
    let i = 10 + tagSize;
    while (i < bytes.length - 1 && bytes[i] === 0) i++; // padding
    expect(bytes[i]).toBe(0xff);
    expect(bytes[i + 1]! & 0xe0).toBe(0xe0); // frame sync
  });
});
