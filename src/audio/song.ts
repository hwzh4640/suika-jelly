/**
 * The loop: 8 bars of 16th-note steps (128 steps) at ~128 BPM in C major.
 * Chords: C | G | Am | F | C | G | F | G — a bright, bouncy pop loop with a call-and-response lead.
 */
export const STEPS_PER_BAR = 16;
export const BARS = 8;
export const STEP_COUNT = STEPS_PER_BAR * BARS;
export const BASE_BPM = 128;

export interface Note {
  /** Scientific pitch, e.g. "E5". */
  n: string;
  /** Length in steps. */
  len: number;
}

export type Track = (Note | null)[];

const CHORDS: readonly (readonly string[])[] = [
  ['C', 'E', 'G'],
  ['G', 'B', 'D'],
  ['A', 'C', 'E'],
  ['F', 'A', 'C'],
  ['C', 'E', 'G'],
  ['G', 'B', 'D'],
  ['F', 'A', 'C'],
  ['G', 'B', 'D'],
];

/** Lead melody, one entry per eighth note ("-" = rest). */
const LEAD_BARS = [
  'E5 G5 E5 C5 D5 E5 C5 -',
  'D5 G5 D5 B4 C5 D5 B4 -',
  'C5 E5 C5 A4 B4 C5 A4 -',
  'A4 C5 A4 F4 G4 A4 C5 -',
  'E5 G5 E5 C5 D5 E5 C5 -',
  'D5 G5 D5 B4 C5 D5 B4 -',
  'A4 C5 F5 E5 D5 C5 A4 G4',
  'B4 D5 G5 F5 E5 D5 B4 G4',
];

const PC = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/** Note of pitch class `pc` in the lowest octave at or above `base` (e.g. above('G4','B') → 'B4', above('G4','D') → 'D5'). */
export function above(base: string, pc: string): string {
  const m = /^([A-G]#?)(\d)$/.exec(base)!;
  const bi = PC.indexOf(m[1]!);
  const pi = PC.indexOf(pc);
  const octave = parseInt(m[2]!, 10) + (pi < bi ? 1 : 0);
  return `${pc}${octave}`;
}

function empty(): Track {
  return new Array<Note | null>(STEP_COUNT).fill(null);
}

function buildLead(): Track {
  const t = empty();
  LEAD_BARS.forEach((bar, b) => {
    bar.split(' ').forEach((n, i) => {
      if (n !== '-') t[b * STEPS_PER_BAR + i * 2] = { n, len: 2 };
    });
  });
  return t;
}

/** Arpeggio on 16ths: root-3rd-5th-octave up and back, octave 4. */
function buildArp(): Track {
  const t = empty();
  const shape = [0, 1, 2, 3, 2, 1, 0, 1, 2, 3, 2, 1, 0, 1, 2, 3];
  CHORDS.forEach((chord, b) => {
    const root = chord[0]! + '4';
    const tones = [root, above(root, chord[1]!), above(root, chord[2]!), chord[0]! + '5'];
    for (let i = 0; i < STEPS_PER_BAR; i++) t[b * STEPS_PER_BAR + i] = { n: tones[shape[i]!]!, len: 1 };
  });
  return t;
}

/** Bass on eighths: R - R R - 5 R -  (octave 2/3). */
function buildBass(): Track {
  const t = empty();
  const pattern = ['R', '-', 'R', 'R', '-', '5', 'R', '-'];
  CHORDS.forEach((chord, b) => {
    const root = chord[0]! + '2';
    const fifth = above(root, chord[2]!);
    pattern.forEach((p, i) => {
      if (p === '-') return;
      t[b * STEPS_PER_BAR + i * 2] = { n: p === 'R' ? root : fifth, len: 2 };
    });
  });
  return t;
}

export type Drum = 'kick' | 'snare' | 'hat' | 'hatSoft';

function buildDrums(): Drum[][] {
  const t: Drum[][] = [];
  for (let s = 0; s < STEP_COUNT; s++) {
    const bar = Math.floor(s / STEPS_PER_BAR);
    const i = s % STEPS_PER_BAR;
    const hits: Drum[] = [];
    if (i === 0 || i === 8) hits.push('kick');
    if (i === 14 && (bar === 3 || bar === 7)) hits.push('kick');
    if (i === 4 || i === 12) hits.push('snare');
    if (i === 15 && bar === 7) hits.push('snare');
    if (i % 2 === 0) hits.push(i % 4 === 0 ? 'hat' : 'hatSoft');
    t.push(hits);
  }
  return t;
}

export const SONG = {
  lead: buildLead(),
  arp: buildArp(),
  bass: buildBass(),
  drums: buildDrums(),
};
