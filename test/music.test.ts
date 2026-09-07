import { describe, expect, it } from 'vitest';
import { noteToFreq, pitchClass } from '../src/audio/notes';
import { SONG, STEP_COUNT, above } from '../src/audio/song';

describe('music', () => {
  it('note frequencies', () => {
    expect(noteToFreq('A4')).toBeCloseTo(440);
    expect(noteToFreq('C5')).toBeCloseTo(523.25, 1);
    expect(noteToFreq('C4')).toBeCloseTo(261.63, 1);
  });
  it('every track is exactly one loop long', () => {
    expect(SONG.lead).toHaveLength(STEP_COUNT);
    expect(SONG.arp).toHaveLength(STEP_COUNT);
    expect(SONG.bass).toHaveLength(STEP_COUNT);
    expect(SONG.drums).toHaveLength(STEP_COUNT);
  });
  it('lead and arp stay in C major', () => {
    const scale = new Set(['C', 'D', 'E', 'F', 'G', 'A', 'B']);
    for (const n of [...SONG.lead, ...SONG.arp, ...SONG.bass]) if (n) expect(scale.has(pitchClass(n.n))).toBe(true);
  });
  it('above() picks the nearest octave up', () => {
    expect(above('G4', 'B')).toBe('B4');
    expect(above('G4', 'D')).toBe('D5');
    expect(above('C4', 'C')).toBe('C4');
    expect(above('A2', 'E')).toBe('E3');
  });
  it('has a kick on every downbeat', () => {
    for (let bar = 0; bar < 8; bar++) expect(SONG.drums[bar * 16]).toContain('kick');
  });
});
