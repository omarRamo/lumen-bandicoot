// Lumen Bandicoot — the soundtrack. Every track is a small pattern-based score (notation: sequencer.js).
// The main theme ("le thème de Lumen": arpeggio up, scale down — 1 3 5 1' . 7 6 5) is the leitmotiv
// quoted by title, map, golden, results, final_boss (in minor), gameover (sad) and ending.

const MOTIF_A = [
  '1 3 5 1\' . 7 6 5',
  '6 . 4 6 1\' - 6 .',
  '7 . 5 7 2\' . 1\' 7',
  '1\' - 5 - 3 . 5 .',
  '1 3 5 1\' . 7 6 5',
  '6 . 4 6 1\' - 2\' 3\'',
  '4\' . 3\' 2\' 1\' . 7 2\'',
  '1\' - - . 5 . 1 .',
];
const MOTIF_CHORDS = ['1', '4', '5', '1', '1', '4', '57', '1'];

export const SONGS = {
  // ------------------------------------------------------------------------------------------ TITLE
  // Crash-style island anthem: marimba hook, rubber bass, log drums, brass bridge.
  title: {
    gain: 1.1, bpm: 132, key: 65, scale: 'major', swing: 0.06, verb: 0.18,
    parts: {
      lead: { type: 'mel', inst: 'marimba', vol: 1, verb: 0.15 },
      lead2: { type: 'mel', inst: 'whistle', oct: 12, vol: 0.45, verb: 0.3 },
      brass: { type: 'mel', inst: 'brass', oct: -12, vol: 0.7 },
      bass: { type: 'bass', inst: 'boingbass', oct: -24, vol: 1 },
      comp: { type: 'chord', inst: 'pan', oct: 0, vol: 0.35 },
      arp: { type: 'arp', inst: 'kalimba', oct: 12, vol: 0.35, echo: 0.2 },
      dr: { type: 'drums', vol: 0.9 },
    },
    sections: {
      I: { chords: ['1', '5'], dr: ['tribal', 'tribalFill'], bass: ['1 . . 5 . . 8 .'], arp: ['0 1 2 3 2 1 2 1'], brass: ['. . . . . . . .', '5, - - - 7, - 2 -'] },
      A: { chords: MOTIF_CHORDS, lead: MOTIF_A, bass: ['1 . . 5 . . 8 .', '1 . . 5 . . 8 .', '1 . . 5 . . 8 .', '1 . . 5 8 . 5 .'], comp: ['..x...x...x...x.'], dr: ['tribal', 'tribal', 'tribal', 'tribalFill'] },
      A2: { chords: MOTIF_CHORDS, lead: MOTIF_A, lead2: MOTIF_A, bass: ['1 . . 5 . . 8 .', '1 . . 5 . . 8 .', '1 . . 5 . . 8 .', '1 . . 5 8 . 5 .'], comp: ['..x...x...x...x.'], arp: ['0 . 2 . 1 . 2 .'], dr: ['island', 'island', 'island', 'islandFill'] },
      B: {
        chords: ['6', '4', '1', '5', '6', '4', '2', '5'],
        brass: ['3\' . 3\' 2\' 1\' . 6 .', '1\' . 1\' 7 6 . 4 .', '5 . 5 6 1\' . 3\' .', '2\' - - - 7 - 5 -', '3\' . 3\' 2\' 1\' . 6 .', '4\' . 3\' 2\' 1\' . 6 .', '2\' . 1\' 6 4 . 6 7', '1\' - 2\' - 3\' - 5\' -'],
        arp: ['0 1 2 3 2 1 2 3'], bass: ['1 . . 5 . . 8 .', '1 . 1 5 . . 8 5'], comp: ['x...x...x...x...'],
        dr: ['tribal', 'tribal', 'tribal', 'tribalFill'],
      },
    },
    form: ['I', 'A', 'A2', 'B', 'A2'], loop: 1,
  },

  // -------------------------------------------------------------------------------------------- MAP
  // The theme, relaxed: whistle + kalimba over a gentle shuffle.
  map: {
    bpm: 100, key: 65, scale: 'major', swing: 0.12,
    parts: {
      lead: { type: 'mel', inst: 'whistle', vol: 0.8, verb: 0.3 },
      arp: { type: 'arp', inst: 'kalimba', vol: 0.45, echo: 0.15 },
      bass: { type: 'bass', inst: 'bass', oct: -24, vol: 0.85 },
      pad: { type: 'chord', inst: 'glasspad', oct: -12, vol: 0.5 },
      dr: { type: 'drums', vol: 0.7 },
    },
    sections: {
      A: {
        chords: ['1', '4', '5', '1', '1', '4', '5', '1'],
        lead: ['1 3 5 1\' . 7 6 5', '6 - - - 4 - - -', '5 . 2 5 7 . 6 5', '5 - - - 3 - - -', '1 3 5 1\' . 7 6 5', '6 . 1\' . 2\' . 4\' -', '3\' - 2\' - 7 - 5 -', '1\' - - - - - . .'],
        arp: ['0 1 2 3 2 1 2 3'], bass: ['1 - - 5 - - 8 -', '1 - - 5 - 3 - -'], pad: ['x---------------'], dr: ['soft'],
      },
      B: {
        chords: ['6', '3', '4', '1', '2', '5', '4', '5'],
        lead: ['6 - 5 - 3 - 1 -', '7, - 1 - 3 - 5 -', '4 - 6 - 1\' - 6 -', '5 - - - 3 - - -', '2 - 4 - 6 - 4 -', '5 - 7 - 2\' - 7 -', '6 - 4 - 1\' - 6 -', '5 - - - . . 7 .'],
        arp: ['0 2 1 3 0 2 1 3'], bass: ['1 - - 5 - - 3 -'], pad: ['x---------------'], dr: ['soft', 'brush'],
      },
    },
    form: ['A', 'B'], loop: 0,
  },

  // ------------------------------------------------------------------------------------------ BEACH
  // Calypso: steel pan lead, marimba arpeggios, 3-3-2 rubber bass, bongos.
  beach: {
    bpm: 138, key: 67, scale: 'major', swing: 0.14,
    parts: {
      lead: { type: 'mel', inst: 'pan', vol: 1, verb: 0.2 },
      arp: { type: 'arp', inst: 'marimba', oct: 0, vol: 0.4 },
      bass: { type: 'bass', inst: 'boingbass', oct: -24, vol: 1 },
      comp: { type: 'chord', inst: 'guitar', oct: -12, vol: 0.35 },
      dr: { type: 'drums', vol: 0.85 },
    },
    sections: {
      A: {
        chords: ['1', '4', '5', '1', '1', '4', '5', '1'],
        lead: ['3 5 . 3 5 6 5 3', '4 6 . 4 6 1\' 6 4', '5 7 . 5 2\' 1\' 7 5', '1\' - 5 - 3 - . .', '3 5 . 3 5 6 5 3', '4 6 . 4 6 1\' 2\' 3\'', '2\' . 1\' 7 5 . 7 2\'', '1\' - - - . . 5 6'],
        bass: ['1 . . 1 . . 5 .'], comp: ['..x...x...x...x.'], dr: ['calypso', 'calypso', 'calypso', 'islandFill'],
      },
      B: {
        chords: ['4', '5', '3', '6', '2', '5', '1', '1'],
        lead: ['1\' . 6 4 1\' . 6 4', '2\' . 7 5 2\' . 7 5', '3\' . 2\' 7 5 . 3 5', '6 - - 5 6 - 1\' -', '2\' . 1\' 6 4 . 6 1\'', '7 . 5 2\' . 4\' 3\' 2\'', '1\' . 5 3 1 . 3 5', '1\' - - - . . . .'],
        arp: ['0 1 2 1 0 1 2 3'], bass: ['1 . . 1 . . 5 .', '1 . . 1 5 . 3 .'], comp: ['..x...x...x...x.'], dr: ['calypso', 'island'],
      },
    },
    form: ['A', 'B'], loop: 0,
  },

  // ----------------------------------------------------------------------------------------- JUNGLE
  // Dorian marimba romp over log drums and tom fills (very Crash 1).
  jungle: {
    bpm: 140, key: 62, scale: 'dorian', swing: 0.08,
    parts: {
      lead: { type: 'mel', inst: 'marimba', vol: 1, verb: 0.15 },
      call: { type: 'mel', inst: 'whistle', oct: 12, vol: 0.5, verb: 0.35, echo: 0.25 },
      arp: { type: 'arp', inst: 'xylo', oct: 0, vol: 0.45 },
      bass: { type: 'bass', inst: 'boingbass', oct: -24, vol: 1 },
      dr: { type: 'drums', vol: 0.9 },
    },
    sections: {
      A: {
        chords: ['1', '4', '1', '4', '1', '7', '4', '5'],
        lead: ['1\' . 1\' 7 5 . 4 5', '6 . 6 5 4 . 2 4', '5 . 1\' . 7 5 4 5', '6 - 4 - 2 - . .', '1\' . 1\' 7 5 . 4 5', '7 . 2\' 7 4\' . 2\' 7', '6 . 1\' . 2\' . 4\' 3\'', '2\' - 1\' - 7 - 5 -'],
        bass: ['1 . 8 . . 5 . 1', '1 . 8 . 5 . 3 .'], dr: ['tribal', 'tribal', 'tribal', 'tribalFill'],
      },
      B: {
        chords: ['3', '7', '4', '5', '3', '7', '4', '1'],
        call: ['5 - 3 - 5 - 7 -', '2\' - 7 - 4 - 7 -', '4 - 6 - 1\' - 6 -', '5 - - - . . 3 4', '5 - 3 - 5 - 7 -', '2\' - 4\' - 3\' 2\' 1\' 7', '1\' - 7 - 6 - 4 -', '1\' - - - . . . .'],
        arp: ['0 1 2 1 3 1 2 1'], bass: ['1 . . 1 . . 5 .'], dr: ['tribal', 'tribalFill'],
      },
    },
    form: ['A', 'B'], loop: 0,
  },

  // ------------------------------------------------------------------------------------------ RIVER
  // Lily pads: flute over flowing harp arpeggios, congas and a lazy groove.
  river: {
    bpm: 108, key: 63, scale: 'major', swing: 0.1, stepsPerBeat: 4,
    parts: {
      lead: { type: 'mel', inst: 'flute', oct: 12, vol: 0.9, verb: 0.3 },
      lead2: { type: 'mel', inst: 'marimba', oct: 0, vol: 0.9, verb: 0.2 },
      arp: { type: 'arp', inst: 'harp', oct: 0, vol: 0.4, verb: 0.2 },
      bass: { type: 'bass', inst: 'bass', oct: -24, vol: 0.9 },
      dr: { type: 'drums', vol: 0.75 },
    },
    drumKit: { river: { k: 'x.......x.......', g: '..x..x....x..x..', b: '.....x.......x..', r: 'xoxoxoxoxoxoxoxo' } },
    sections: {
      A: {
        chords: ['1', '6', '4', '5', '1', '6', '2', '5'],
        lead: ['3 - 5 - 1\' - 7 6', '5 - 3 - 1 - - -', '4 - 6 - 1\' - 2\' 1\'', '7 - 5 - - - . .', '3 - 5 - 1\' - 3\' 2\'', '1\' - 6 - 3 - 5 6', '4 - 6 - 2\' - 1\' 7', '5 - - - - - . .'],
        arp: ['0123432101234321'], bass: ['1 - - - 5 - 3 -'], dr: ['river'],
      },
      B: {
        chords: ['4', '5', '3', '6', '4', '5', '1', '1'],
        lead2: ['6 - 4 - 1\' - 6 -', '7 - 5 - 2\' - 7 -', '5 - 3 - 7 - 5 -', '1\' - - - 6 - - -', '4\' - 3\' - 2\' - 1\' -', '7 - 1\' - 2\' - 5 -', '3 - 5 - 1\' - - -', '- - - - . . . .'],
        arp: ['0123210123432101'], bass: ['1 - - 5 - - 8 -'], dr: ['river', 'brush'],
      },
    },
    form: ['A', 'B'], loop: 0,
  },

  // ----------------------------------------------------------------------------------------- DESERT
  // Tozeur dunes: ney flute in hijaz, oud answers, darbuka maqsum, drone.
  desert: {
    bpm: 112, key: 64, scale: 'hijaz', swing: 0.04,
    parts: {
      lead: { type: 'mel', inst: 'flute', oct: 12, vol: 0.85, verb: 0.35 },
      oud: { type: 'mel', inst: 'oud', oct: 0, vol: 1, verb: 0.15 },
      bass: { type: 'bass', inst: 'pluckbass', oct: -24, vol: 0.9 },
      drone: { type: 'bass', inst: 'drone', oct: -12, vol: 0.55 },
      dr: { type: 'drums', vol: 0.9 },
    },
    sections: {
      A: {
        chords: ['1', '2', '7', '1', '4', '4', '2', '1'],
        lead: ['5 - 6 5 3 - 2 3', '4 - 3 2 3 - - .', '7, - 1 2 3 - 2 1', '1 - - - . . 5, 7,', '1 - 3 4 5 - 6 5', '4 . 3 . 2 . 3 .', '3 - 4 6 5 4 3 2', '1 - - - - . . .'],
        bass: ['1 . . 1 5 . 1 .'], drone: ['1 - - - - - - -'], dr: ['maqsum', 'maqsum', 'maqsum', 'maqsumFill'],
      },
      B: {
        chords: ['1', '1', '2', '1', '7', '7', '2', '1'],
        oud: ['1 2 3 2 1 . 1 2 3 4 5 4 3 . . .', '5 6 5 4 3 4 3 2 1 - - - . . . .', '2 3 4 5 6 5 4 3 2 - - - 3 - 2 -', '1 - - - - - - - . . . . 5, 6, 7, .', '7, 1 2 3 4 3 2 1 7, - - - . . . .', '4 3 2 1 2 3 4 5 4 - - - . . . .', '6 5 4 3 4 3 2 1 2 - - - 3 - - -', '1 - - - - - - - . . . . . . . .'],
        bass: ['1 . . 1 5 . 1 .'], drone: ['1 - - - - - - -'], dr: ['maqsum', 'maqsumFill'],
      },
    },
    form: ['A', 'B'], loop: 0,
  },

  // ----------------------------------------------------------------------------------------- MEDINA
  // Souk party: mezoued (Tunisian bagpipe) over fast malfuf darbuka and hand claps.
  medina: {
    gain: 1.2, bpm: 132, key: 62, scale: 'hijaz',
    parts: {
      lead: { type: 'mel', inst: 'mezoued', oct: 12, vol: 0.9, verb: 0.15 },
      oud: { type: 'mel', inst: 'oud', oct: 0, vol: 0.8 },
      bass: { type: 'bass', inst: 'pluckbass', oct: -24, vol: 0.9 },
      drone: { type: 'bass', inst: 'drone', oct: -12, vol: 0.4 },
      dr: { type: 'drums', vol: 0.95 },
    },
    drumKit: {
      souk: { d: 'x.......x.......', e: '...x..x....x..x.', a: '.o...o...o...o.o', q: 'x.x.x.x.x.x.x.x.', c: '....x.......x...' },
      soukFill: { d: 'x..x..x.x..x..x.', e: '.x.x.xxx.x.x.xxx', q: 'x.x.x.x.x.x.x.x.', c: 'x...x...x.x.x.x.' },
    },
    sections: {
      A: {
        chords: ['1', '2', '1', '2', '7', '4', '2', '1'],
        lead: ['1 2 3 2 3 4 5 -', '6 5 4 3 2 - - -', '1 2 3 2 3 4 5 6', '5 4 3 2 3 - 2 1', '7, 1 2 3 4 - 3 2', '1 2 3 4 5 - 4 3', '2 3 4 5 4 3 2 3', '1 - 1 - 1 . . .'],
        bass: ['1 . . 1 . . 5 .'], drone: ['1 - - - - - - -'], dr: ['souk', 'souk', 'souk', 'soukFill'],
      },
      B: {
        chords: ['1', '1', '7', '7', '2', '2', '1', '1'],
        lead: ['5 5 5 . 6 5 4 3', '. . . . . . . .', '4 4 4 . 5 4 3 2', '. . . . . . . .', '2 3 4 2 3 4 5 3', '4 5 6 4 5 - 4 3', '2 - 1 - 2 - 3 -', '1 - - - . 1\' 1\' 1\''],
        oud: ['. . . . . . . .', '4 3 2 . 1 . . .', '. . . . . . . .', '3 2 1 . 7, . . .'],
        bass: ['1 . . 1 . . 5 .'], drone: ['1 - - - - - - -'], dr: ['souk', 'soukFill'],
      },
    },
    form: ['A', 'B'], loop: 0,
  },

  // ---------------------------------------------------------------------------------------- SIDIBOU
  // Blue & white stairs: a lilting 12/8 malouf-style tune, oud + flute, riq, harp.
  sidibou: {
    gain: 1.25, bpm: 76, stepsPerBeat: 3, barSteps: 12, key: 69, scale: 'harmonic',
    parts: {
      lead: { type: 'mel', inst: 'oud', oct: 0, vol: 1, verb: 0.2 },
      flute: { type: 'mel', inst: 'flute', oct: 0, vol: 0.8, verb: 0.3 },
      arp: { type: 'arp', inst: 'harp', oct: -12, vol: 0.35 },
      bass: { type: 'bass', inst: 'pluckbass', oct: -24, vol: 0.85 },
      dr: { type: 'drums', vol: 0.8 },
    },
    drumKit: {
      lilt: { d: 'x.....x..x..', e: '..x.x...x..x', q: 'x.xx.xx.xx.x' },
      liltFill: { d: 'x.....x.....', e: '..x.x.xxxxxx', q: 'x.xx.xx.xx.x' },
    },
    sections: {
      A: {
        chords: ['1', '4', '5', '1', '6', '4', '5', '1'],
        lead: ['5 - 1\' 7 - 6 5 - 4 3 - -', '4 - 6 5 - 4 3 - 2 1 - -', '7, - 2 3 - 4 5 - 4 2 - -', '1 - - - - - . . . 5, 6, 7,', '1 - 3 6 - 5 3 - 1 6, - -', '4 - 6 1\' - 7 6 - 4 6 - 5', '7 - 5 2 - 4 5 - 6 7 - -', '1\' - - - - - . . . . . .'],
        arp: ['0 1 2 3 2 1'], bass: ['1 . . . . . 5 . . . . .'], dr: ['lilt', 'lilt', 'lilt', 'liltFill'],
      },
      B: {
        chords: ['6', '3M', '4', '1', '6', '3M', '5', '5'],
        flute: ['3 - - 1 - 3 6 - - 5 - -', '5 - - 3 - 5 b7 - - 5 - -', '6 - - 4 - 6 1\' - - 6 - -', '5 - - - - - 3 - - 1 - -', '3 - - 1 - 3 6 - - 5 - -', '5 - - 3 - 5 b7 - - 1\' - -', '7 - - 5 - 7 2\' - - 7 - -', '5 - - - - - 7 - 1\' 2\' - -'],
        arp: ['0 1 2 3 2 1'], bass: ['1 . . . . . 5 . . . . .'], dr: ['lilt', 'liltFill'],
      },
    },
    form: ['A', 'B'], loop: 0,
  },

  // -------------------------------------------------------------------------------------------- ICE
  // Glacier: lydian glockenspiel, celesta bells, sleigh bells, music box.
  ice: {
    bpm: 124, key: 72, scale: 'lydian', swing: 0.05,
    parts: {
      lead: { type: 'mel', inst: 'glock', vol: 1, verb: 0.3 },
      bell: { type: 'mel', inst: 'bell', oct: 0, vol: 0.9, verb: 0.35 },
      arp: { type: 'arp', inst: 'musicbox', oct: 0, vol: 0.4, echo: 0.2 },
      bass: { type: 'bass', inst: 'bass', oct: -36, vol: 0.85 },
      pad: { type: 'chord', inst: 'glasspad', oct: -12, vol: 0.45 },
      dr: { type: 'drums', vol: 0.7 },
    },
    sections: {
      A: {
        chords: ['1', '2', '1', '2', '6', '5', '2', '1'],
        lead: ['1\' . 5 . 3 5 1\' 2\'', '3\' . 2\' . 4 6 2\' .', '1\' . 5 . 3 5 1\' 3\'', '2\' - - - . . . .', '1\' . 6 . 3 6 1\' 3\'', '2\' . 7 . 5 7 2\' 4\'', '3\' - 2\' - 6 - 4 -', '5 - - - . . . .'],
        bass: ['1 . . 5 1 . . .', '1 . . 5 8 . 5 .'], pad: ['x---------------'], dr: ['ice'],
      },
      B: {
        chords: ['6', '3', '2', '5', '6', '3', '2', '2'],
        bell: ['3 - 6 - 1\' - 3\' -', '2\' - 7 - 5 - 3 -', '4 - 6 - 2\' - 4\' -', '2\' - - - 7 - 5 -', '3 - 6 - 1\' - 3\' -', '5\' - 3\' - 2\' - 7 -', '6 - 4 - 2 - 4 -', '6 - - - . . . .'],
        arp: ['0 1 2 3 4 3 2 1 0 1 2 3 4 3 2 1'], bass: ['1 - - - 5 - - -'], pad: ['x---------------'], dr: ['ice', 'halftime'],
      },
    },
    form: ['A', 'B'], loop: 0,
  },

  // ------------------------------------------------------------------------------------------- CAVE
  // Crystal cave: dripping woodblocks, echoing kalimba, dark pad.
  cave: {
    bpm: 96, key: 69, scale: 'minor', echoTime: 0.375,
    parts: {
      lead: { type: 'mel', inst: 'kalimba', vol: 1, verb: 0.3, echo: 0.45 },
      bell: { type: 'mel', inst: 'bell', oct: 0, vol: 0.75, verb: 0.4, echo: 0.3 },
      ost: { type: 'arp', inst: 'marimba', oct: -12, vol: 0.4 },
      bass: { type: 'bass', inst: 'bass', oct: -24, vol: 0.8 },
      pad: { type: 'chord', inst: 'pad', oct: -12, vol: 0.6, verb: 0.3 },
      dr: { type: 'drums', vol: 0.75 },
    },
    sections: {
      A: {
        chords: ['1', '6', '7', '1', '4', '6', '5', '5'],
        lead: ['5 . . 1\' . . 7 5', '3 . . 6 . . 5 3', '2 . . 5 . . 4 2', '1 - - - . . . .', '4 . . 1\' . . 6 4', '3 . . 1\' . . 6 3', '2 . . 5 . . 7 5', '7, - - - . . . .'],
        bass: ['1 - - - - - 5 -'], pad: ['x---------------'], dr: ['drip'],
      },
      B: {
        chords: ['4', '5', '1', '1', '4', '5', '6', '5'],
        bell: ['6 - - - 4 - 1\' -', '7 - - - 5 - 2\' -', '1\' - - - 3\' - - -', '5\' - - - - - . .', '4\' - - 3\' 1\' - 6 -', '5 - - 7 2\' - 5 -', '6 - - - 1\' - 3\' -', '2\' - - - - - . .'],
        ost: ['0 . 2 1 . 2 0 .'], bass: ['1 - - - - - 5 -'], pad: ['x---------------'], dr: ['drip', 'halftime'],
      },
    },
    form: ['A', 'B'], loop: 0,
  },

  // ----------------------------------------------------------------------------------------- AURORA
  // Northern lights: slow bells over glassy pads, music-box shimmer, half-time pulse.
  aurora: {
    gain: 1.35, bpm: 80, key: 64, scale: 'minor', echoTime: 0.5625,
    parts: {
      lead: { type: 'mel', inst: 'bell', oct: 12, vol: 0.9, verb: 0.45, echo: 0.3 },
      arp: { type: 'arp', inst: 'musicbox', oct: 12, vol: 0.3, echo: 0.3 },
      pad: { type: 'chord', inst: 'glasspad', oct: 0, vol: 0.7, verb: 0.4 },
      bass: { type: 'bass', inst: 'sub', oct: -24, vol: 0.6 },
      dr: { type: 'drums', vol: 0.6 },
    },
    sections: {
      A: {
        chords: ['1', '6', '3', '7', '1', '6', '4', '5'],
        lead: ['5 - 1\' 2\'', '3\' - - -', '2\' - 7 5', '4 - - -', '5 - 1\' 2\'', '3\' - 5\' 3\'', '4\' - 3\' 1\'', '2\' - - -'],
        arp: ['0 . 1 . 2 . 3 . 4 . 3 . 2 . 1 .'], pad: ['x-------'], bass: ['1 - - - - - - -'], dr: ['halftime'],
      },
      B: {
        chords: ['4', '5', '3', '6', '4', '5', '1', '1'],
        lead: ['6 - 1\' 4\'', '7 - 2\' 5\'', '5\' - 3\' 7', '6\' - - -', '4\' - 1\' 6', '5\' - 2\' 7', '1\' - 5 3', '1\' - - -'],
        arp: ['0 1 2 3 4 3 2 1 0 1 2 3 4 3 2 1'], pad: ['x-------'], bass: ['1 - - - - - - -'], dr: ['halftime', 'soft'],
      },
    },
    form: ['A', 'B'], loop: 0,
  },

  // ---------------------------------------------------------------------------------------- FACTORY
  // Dr Cortisol's factory: slap-bass funk, clavinet, metal clanks, steam, brass stabs.
  factory: {
    gain: 1.3, bpm: 112, key: 64, scale: 'dorian', swing: 0.1,
    parts: {
      lead: { type: 'mel', inst: 'square', oct: 0, vol: 0.8, echo: 0.15 },
      horns: { type: 'mel', inst: 'brass', oct: -12, vol: 0.75 },
      stab: { type: 'chord', inst: 'brass', oct: 0, vol: 0.45 },
      clav: { type: 'chord', inst: 'clav', oct: 0, vol: 0.5 },
      bass: { type: 'bass', inst: 'slap', oct: -24, vol: 1 },
      dr: { type: 'drums', vol: 0.9 },
    },
    drumKit: {
      press: { k: 'x..x......x..x..', s: '....X..o.o..X...', h: 'xoxoxoxoxoxoxoxo', m: '.......x.......x', f: '..........x.....' },
      pressFill: { k: 'x..x......x.....', s: '....X..o.o..XoXX', h: 'xoxoxoxoxoxo....', m: '...x...x...x.xxx', M: 'x...............' },
    },
    sections: {
      A: {
        chords: ['17', '47', '17', '47', '3', '4', '5', '47'],
        lead: ['1\' . 3\' . 1\' 7 . 5 . . 4 . 5 . . .', '. . . . 6 . 5 . 4 . 3 . 4 . . .', '1\' . 3\' . 1\' 7 . 5 . . 4 . 5 . . .', '. . . . 6 . 5 . 4 . 3 . 1 . . .', '5 . 5 . 3 5 . 7 . 5 . 3 . 2 . .', '4 . 4 . 3 4 . 6 . 4 . 3 . 1 . .', '2 . 5 . 7 . 2\' . . 1\' 7 . 5 . . .', '6 . 1\' . 3\' . . 2\' 1\' . 6 . 5 . . .'],
        bass: ['1 . . 1 8 . 1 . . 1 . 5 7 . 8 .'], clav: ['.x.x..x..x.x..x.'], dr: ['press', 'press', 'press', 'pressFill'],
      },
      B: {
        chords: ['3', '4', '17', '17', '3', '4', '17', '17'],
        horns: ['5 - 3 - 5 7 - -', '6 - 4 - 6 1\' - -', '1\' 7 5 3 1 . 3 4', '5 - - - . . . .', '5 - 3 - 5 7 - -', '6 - 4 - 6 1\' - -', '3\' 2\' 1\' 7 5 . 7 .', '1\' - - - . . . .'],
        stab: ['X..X......X.....'], bass: ['1 . . 1 8 . 1 . . 1 . 5 7 . 8 .', '1 . 1 . 8 . 1 . 5 . 7 . 8 . 5 .'], dr: ['press', 'pressFill'],
      },
    },
    form: ['A', 'B'], loop: 0,
  },

  // -------------------------------------------------------------------------------------------- LAB
  // Toxic lab: a spooky-silly waltz — combo organ, tuba oom-pa-pa, theremin, bubbling zaps.
  lab: {
    bpm: 168, barSteps: 12, key: 60, scale: 'harmonic',
    parts: {
      lead: { type: 'mel', inst: 'organ', oct: 0, vol: 0.85, verb: 0.2 },
      ther: { type: 'mel', inst: 'theremin', oct: 12, vol: 0.85, verb: 0.35, echo: 0.2 },
      pa: { type: 'chord', inst: 'organ', oct: -12, vol: 0.35 },
      bass: { type: 'bass', inst: 'tuba', oct: -24, vol: 1 },
      dr: { type: 'drums', vol: 0.75 },
    },
    drumKit: {
      waltz: { k: 'x...........', w: '....x...x...', z: '...........x' },
      waltz2: { k: 'x...........', w: '....x...x...', z: '.........x.x', r: '..x...x...x.' },
    },
    sections: {
      A: {
        chords: ['1', '1', '4', '4', '5', '5', '1', '1', '6', '6', '4', '4', '2', '5', '1', '1'],
        lead: ['1 - 3 - 5 -', '6 - 5 - - -', '4 - 6 - 1\' -', '2\' - 1\' - - -', '7 - 2\' - 4\' -', '3\' - 2\' - 7 -', '1\' - 5 - 3 -', '1 - - - . .', '3 - 6 - 1\' -', '3\' - 1\' - 6 -', '4 - 6 - 1\' -', '4\' - 3\' - 2\' -', '2 - 4 - 6 -', '7, - 2 - 4 -', '1 - 5 - 3\' -', '1\' - - - . .'],
        pa: ['.xx'], bass: ['1 . .', '5, . .'], dr: ['waltz', 'waltz', 'waltz', 'waltz2'],
      },
      B: {
        chords: ['1', '6', '4', '5', '1', '6', '5', '5'],
        ther: ['5 - - - 3 -', '6 - - - 1\' -', '4\' - - - 3\' -', '2\' - - - 7 -', '1\' - - - 5 -', '3\' - - - 1\' -', '7 - - - 2\' -', '4\' - 3\' - 2\' -'],
        pa: ['.xx'], bass: ['1 . .', '5, . .'], dr: ['waltz2'],
      },
    },
    form: ['A', 'B'], loop: 0,
  },

  // ------------------------------------------------------------------------------------------ SPACE
  // Cardboard rocket: synthwave arps, octave bass, glass pad and zaps.
  space: {
    bpm: 120, key: 62, scale: 'minor', echoTime: 0.375,
    parts: {
      lead: { type: 'mel', inst: 'square', oct: 12, vol: 0.75, verb: 0.25, echo: 0.3 },
      arp: { type: 'arp', inst: 'glock', oct: 0, vol: 0.3, echo: 0.2 },
      bass: { type: 'bass', inst: 'synbass', oct: -24, vol: 0.9 },
      pad: { type: 'chord', inst: 'pad', oct: 0, vol: 0.55, verb: 0.3 },
      dr: { type: 'drums', vol: 0.85 },
    },
    sections: {
      A: {
        chords: ['1', '6', '3', '7', '1', '6', '4', '5'],
        lead: ['5 - - - 1\' - 2\' -', '3\' - - - 2\' - 1\' -', '1\' - 7 - 5 - 3 -', '4 - - - - - . .', '5 - - - 1\' - 2\' -', '3\' - - - 4\' - 5\' -', '6\' - 5\' - 4\' - 3\' -', '2\' - - - - - . .'],
        arp: ['0120120120120121'], bass: ['1 8 1 8 1 8 1 8'], pad: ['x---------------'], dr: ['space'],
      },
      B: {
        chords: ['6', '7', '1', '1', '6', '7', '5', '5'],
        arp: ['0123012301230123'], bass: ['1 - 1 8 - 1 8 -'], pad: ['x---------------'], dr: ['halftime', 'space'],
        lead: ['. . . . . . . .', '. . . . . . . .', '1\' 2\' 3\' 5\' 3\' 2\' 1\' 5', '1\' - - - . . . .', '. . . . . . . .', '. . . . . . . .', '2\' 3\' 5\' 6\' 5\' 3\' 2\' 7', '2\' - - - . . . .'],
      },
    },
    form: ['A', 'B'], loop: 0,
  },

  // ------------------------------------------------------------------------------------------ TOWER
  // The Tower of Stress: ticking clocks, string ostinato, organ, timpani — climbing tension.
  tower: {
    bpm: 144, key: 67, scale: 'harmonic',
    parts: {
      lead: { type: 'mel', inst: 'organ', oct: 0, vol: 0.8, verb: 0.25 },
      horns: { type: 'mel', inst: 'brass', oct: -12, vol: 0.8, verb: 0.15 },
      ost: { type: 'arp', inst: 'strings', oct: -12, vol: 0.5 },
      bass: { type: 'bass', inst: 'synbass', oct: -24, vol: 0.85 },
      dr: { type: 'drums', vol: 0.85 },
    },
    drumKit: {
      clock: { y: 'x...x...x...x...', k: 'x.......x.......', s: '....x.......x...', h: '..x...x...x...x.' },
      clockFill: { y: 'x.x.x.x.x.x.x.x.', k: 'x.......x.......', s: '....x.......xxxx', p: 'x...............' },
    },
    sections: {
      A: {
        chords: ['1', '1', '6', '6', '4', '4', '5', '5'],
        lead: ['5 - 1\' -', '2\' 3\' 2\' 1\'', '3\' - 1\' -', '6 5 3 -', '4 - 6 -', '1\' 7 6 5', '7 - 2\' -', '5 - - -'],
        ost: ['0102010201020102'], bass: ['1 . 1 . 1 . 1 .'], dr: ['clock', 'clock', 'clock', 'clockFill'],
      },
      B: {
        chords: ['1', 'b7M', '6', '5', '1', 'b7M', '6', '5'],
        horns: ['1\' - - 5', '4\' - 2\' -', '3\' - 1\' -', '2\' 1\' 7 6', '1\' - - 5', '4\' - 2\' -', '3\' - 1\' -', '7 - - -'],
        ost: ['0121012101210121'], bass: ['1 1 . 1 1 . 1 8'], dr: ['clock', 'rock', 'clock', 'clockFill'],
      },
    },
    form: ['A', 'B'], loop: 0,
  },

  // ----------------------------------------------------------------------------------------- GOLDEN
  // Secret golden moon: the theme as a shimmering bossa — glock, electric piano, harp.
  golden: {
    bpm: 116, key: 62, scale: 'major', swing: 0.1,
    parts: {
      lead: { type: 'mel', inst: 'glock', oct: 12, vol: 0.9, verb: 0.35 },
      comp: { type: 'chord', inst: 'epiano', oct: 0, vol: 0.5, verb: 0.2 },
      arp: { type: 'arp', inst: 'harp', oct: 0, vol: 0.35 },
      choir: { type: 'chord', inst: 'choir', oct: 0, vol: 0.35, verb: 0.4 },
      bass: { type: 'bass', inst: 'bass', oct: -24, vol: 0.85 },
      dr: { type: 'drums', vol: 0.7 },
    },
    drumKit: { bossa: { k: 'x..x..x.x..x..x.', w: 'x..x..x...x..x..', r: 'xoxxxoxxxoxxxoxx' } },
    sections: {
      A: {
        chords: ['17', '47', '57', '17', '17', '47', '57', '17'],
        lead: MOTIF_A, comp: ['x..x..x...x.....'], bass: ['1 . . 5 1 . 5 .'], dr: ['bossa'],
      },
      B: {
        chords: ['6', '2', '5', '1', '6', '2', '5', '5'],
        lead: ['3\' - 1\' - 6 - 1\' -', '2\' - 6 - 4 - 6 -', '7 - 5 - 2\' - 4\' -', '3\' - - - 1\' - - -', '3\' - 5\' - 3\' - 1\' -', '2\' - 4\' - 2\' - 6 -', '7 - 2\' - 5\' - 4\' -', '2\' - - - . . . .'],
        arp: ['0123210123432101'], choir: ['x-------'], bass: ['1 . . 5 1 . 5 .'], dr: ['bossa'],
      },
    },
    form: ['A', 'B'], loop: 0,
  },

  // ------------------------------------------------------------------------------------------- BOSS
  // Epic & silly: saw lead + brass, timpani, then a tuba/trombone "wah-wah" comedy break.
  boss: {
    bpm: 152, key: 60, scale: 'minor',
    parts: {
      lead: { type: 'mel', inst: 'saw', oct: 12, vol: 0.75, verb: 0.15 },
      horns: { type: 'mel', inst: 'brass', oct: 0, vol: 0.6 },
      bone: { type: 'mel', inst: 'bone', oct: 0, vol: 0.9 },
      stab: { type: 'chord', inst: 'strings', oct: 0, vol: 0.5 },
      bass: { type: 'bass', inst: 'tuba', oct: -24, vol: 1 },
      dr: { type: 'drums', vol: 0.9 },
    },
    sections: {
      A: {
        chords: ['1', '1', '6', '7', '1', '1', '4', '5M'],
        lead: ['1\' . 1\' 7 1\' . 5 .', '3\' . 2\' 1\' 2\' . 5 .', '1\' . 1\' 7 1\' . 3\' .', '2\' . 1\' 7 5 - - .', '1\' . 1\' 7 1\' . 5 .', '3\' . 4\' 5\' 6\' . 5\' .', '4\' . 3\' 1\' 6 . 1\' .', '#7 . 2\' . 5\' - - -'],
        horns: ['1 . 1 7, 1 . 5, .', '3 . 2 1 2 . 5, .', '1 . 1 7, 1 . 3 .', '2 . 1 7, 5, - - .'],
        stab: ['X.....X.....X...'], bass: ['1 . 5, . 1 . 5, .'], dr: ['boss', 'boss', 'boss', 'bossFill'],
      },
      B: {
        chords: ['1', '5M', '1', '5M', '4', '1', '5M', '5M'],
        bone: ['5 - 3 - 1 - . .', '#7, - 2 - 5 - . .', '3 - 5 - 1\' - . .', '2\' - #7 - 5 - . .', '4 - 6 - 1\' - 6 -', '5 - 3 - 1 - 3 -', '2 - 4 - 5 - #7 -', '2\' - - - - - . .'],
        bass: ['1 . 5, . 1 . 5, .'], dr: ['march', 'march', 'march', 'bossFill'],
      },
    },
    form: ['A', 'B'], loop: 0,
  },

  // ------------------------------------------------------------------------------------- FINAL BOSS
  // Dr Néo Cortisol: villain organ + choir, heavy drums; then the hero theme in minor on brass.
  final_boss: {
    bpm: 160, key: 62, scale: 'harmonic',
    parts: {
      lead: { type: 'mel', inst: 'organ', oct: 0, vol: 0.8, verb: 0.25 },
      saw: { type: 'mel', inst: 'saw', oct: 12, vol: 0.45 },
      horns: { type: 'mel', inst: 'brass', oct: 0, vol: 0.9, verb: 0.2 },
      choir: { type: 'chord', inst: 'choir', oct: 0, vol: 0.5, verb: 0.4 },
      bass: { type: 'bass', inst: 'synbass', oct: -24, vol: 0.95 },
      dr: { type: 'drums', vol: 0.95 },
    },
    sections: {
      A: {
        chords: ['1', '1', '6', '5', '1', '1', '4', '5'],
        lead: ['1 - 2 - 3 - 2 1', '5 - - - 4 - 3 -', '3 - - 6 - - 5 -', '7, - - - 2 - 5 -', '1 - 2 - 3 - 2 1', '5 - 6 - 7 - 1\' -', '4 - - - 3 - 1 -', '2 - - - 7, - - -'],
        saw: ['1 - 2 - 3 - 2 1', '5 - - - 4 - 3 -', '3 - - 6 - - 5 -', '7, - - - 2 - 5 -'],
        choir: ['x-------'], bass: ['1 1 8 1 1 8 1 8'], dr: ['boss', 'boss', 'boss', 'bossFill'],
      },
      B: {
        chords: ['1', '6', '5', '1', '1', '6', '5', '5'],
        horns: ['1 3 5 1\' . 7 6 5', '6 . 4 6 1\' - 6 .', '7 . 5 7 2\' . 1\' 7', '1\' - 5 - 3 . 5 .', '1 3 5 1\' . 7 6 5', '6 . 4 6 1\' - 2\' 3\'', '4\' . 3\' 2\' 1\' . 7 2\'', '1\' - - . 5 . 7 .'],
        choir: ['x-------'], bass: ['1 . 1 8 1 . 1 8'], dr: ['rock', 'rock', 'rock', 'bossFill'],
      },
    },
    form: ['A', 'B'], loop: 0,
  },

  // ------------------------------------------------------------------------------------------ CHASE
  // Run! Galloping synth bass, frantic square lead, snare rolls, brass "duh-duh-DUH".
  chase: {
    bpm: 172, key: 69, scale: 'minor',
    parts: {
      lead: { type: 'mel', inst: 'square', oct: 0, vol: 0.8 },
      whistle: { type: 'mel', inst: 'whistle', oct: 12, vol: 0.55 },
      stab: { type: 'chord', inst: 'brass', oct: -12, vol: 0.5 },
      bass: { type: 'bass', inst: 'synbass', oct: -24, vol: 0.95 },
      dr: { type: 'drums', vol: 0.9 },
    },
    sections: {
      A: {
        chords: ['1', '1', '6', '7', '1', '1', '4', '5M'],
        lead: ['5 . 5 . 1\' . 5 . 6 5 4 3 4 . 2 .', '3 . 3 . 5 . 3 . 4 3 2 1 2 . 7, .', '1 . 3 . 6 . 3 . 1\' . 6 . 3 . 1 .', '2 . 4 . 7 . 4 . 2\' . 7 . 4 . 2 .', '5 . 5 . 1\' . 5 . 6 5 4 3 4 . 2 .', '3 . 3 . 5 . 3 . 1\' . 3\' . 5\' . . .', '4\' . 3\' . 1\' . 6 . 4 . 6 . 1\' . 4\' .', '#7 . 2\' . 5\' . 2\' . #7 . 5 . #7 . 2\' .'],
        bass: ['1 1 8 1 1 8 1 8'], dr: ['chase', 'chase', 'chase', 'chaseFill'],
      },
      B: {
        chords: ['6', '7', '5M', '5M', '6', '7', '1', '5M'],
        whistle: ['6 - 1\' - 3\' - 1\' -', '7 - 2\' - 4\' - 2\' -', '5 - #7 - 2\' - 5\' -', '5\' - 2\' - #7 - 5 -', '6 - 1\' - 3\' - 6\' -', '5\' - 4\' - 2\' - 7 -', '1\' - 3\' - 5\' - 3\' -', '#7 - - - - - . .'],
        stab: ['X..X..X.....X...'], bass: ['1 1 8 1 1 8 1 8'], dr: ['chase', 'chaseFill'],
      },
    },
    form: ['A', 'B'], loop: 0,
  },

  // ------------------------------------------------------------------------------------------- RIDE
  // Mount levels (snail, camel, penguin, rocket): surf-rock gallop with echo guitar and cowbell.
  ride: {
    bpm: 150, key: 64, scale: 'mixolydian', echoTime: 0.3,
    parts: {
      lead: { type: 'mel', inst: 'guitar', oct: 0, vol: 1, echo: 0.3 },
      whistle: { type: 'mel', inst: 'whistle', oct: 12, vol: 0.5, verb: 0.2 },
      gal: { type: 'chord', inst: 'mutegtr', oct: -12, vol: 0.35 },
      bass: { type: 'bass', inst: 'bass', oct: -24, vol: 0.9 },
      dr: { type: 'drums', vol: 0.85 },
    },
    drumKit: { gallop2: { k: 'x..x..x.x..x..x.', s: '....x.......x...', B: 'x...x...x...x...', T: '..xx......xx....', h: 'x.x.x.x.x.x.x.x.' } },
    sections: {
      A: {
        chords: ['1', '7', '4', '1', '1', '7', '4', '5M'],
        lead: ['1\' 1\' 7 1\' 3\' - 1\' -', '7 7 6 7 2\' - 7 -', '6 6 5 6 1\' - 6 -', '5 - 3 - 1 - . .', '1\' 1\' 7 1\' 3\' - 5\' -', '4\' - 2\' - 7 - 2\' -', '3\' - 1\' - 6 - 4 -', '5 - 2\' - #7 - 5 -'],
        gal: ['x.xxx.xxx.xxx.xx'], bass: ['1 . 1 1 5 . 5 5 8 . 8 8 5 . 5 5'], dr: ['gallop', 'gallop', 'gallop', 'rockFill'],
      },
      B: {
        chords: ['4', '4', '1', '1', '4', '4', '5M', '5M'],
        whistle: ['6 - - 5 6 - 1\' -', '6 - 5 4 1 - - -', '5 - - 4 5 - 1\' -', '5 - 4 3 1 - - -', '1\' - - 7 1\' - 3\' -', '2\' - 1\' 6 4 - - -', '2\' - - - #7 - 5 -', '2\' - - - - - . .'],
        gal: ['x.xxx.xxx.xxx.xx'], bass: ['1 . 1 1 5 . 5 5 8 . 8 8 5 . 5 5'], dr: ['gallop2', 'gallop2', 'gallop2', 'rockFill'],
      },
    },
    form: ['A', 'B'], loop: 0,
  },

  // ---------------------------------------------------------------------------------------- VICTORY
  // Short jingle (plays once): the motif, a brass cadence and a cymbal.
  victory: {
    gain: 1.1, bpm: 150, key: 65, scale: 'major', loop: false, disco: false,
    parts: {
      lead: { type: 'mel', inst: 'marimba', vol: 1, verb: 0.2 },
      lead2: { type: 'mel', inst: 'glock', oct: 12, vol: 0.5, verb: 0.3 },
      horns: { type: 'mel', inst: 'brass', oct: -12, vol: 0.9, verb: 0.2 },
      bass: { type: 'bass', inst: 'boingbass', oct: -24, vol: 1 },
      dr: { type: 'drums', vol: 0.9 },
    },
    drumKit: {
      v1: { k: 'x.......x.......', s: '....x.......x...', l: 'x.x.x.x.x.xxxxxx' },
      v2: { k: 'x.......x.......', s: '....x...x.x.xxxx', t: '........x.x.x.x.' },
      v3: { k: 'x...............', x: 'x...............', p: 'x...............' },
    },
    sections: {
      J: {
        chords: ['1', '4 5', '1'],
        lead: ['1 3 5 1\' . 7 6 5', '6 . 1\' . 7 . 2\' .', '1\' - - - - - . .'],
        lead2: ['. . . . . . . .', '. . . . . . . .', '1\' - - - - - . .'],
        horns: ['. . . . . . . .', '4 - - - 5 - - -', '5 - - - - - . .'],
        bass: ['1 . 5 . 8 . 5 .', '1 . . . 1 . . .', '1 - - - . . . .'],
        dr: ['v1', 'v2', 'v3'],
      },
    },
    form: ['J'],
  },

  // --------------------------------------------------------------------------------------- GAMEOVER
  // Sad trombone sting, then a tender music-box lament of the theme in minor.
  gameover: {
    gain: 1.7, bpm: 76, key: 65, scale: 'minor', disco: false,
    parts: {
      bone: { type: 'mel', inst: 'bone', oct: -12, vol: 1 },
      lead: { type: 'mel', inst: 'musicbox', oct: 12, vol: 0.8, verb: 0.4 },
      pad: { type: 'chord', inst: 'glasspad', oct: -12, vol: 0.5 },
      bass: { type: 'bass', inst: 'sub', oct: -24, vol: 0.4 },
      dr: { type: 'drums', vol: 0.6 },
    },
    sections: {
      I: {
        chords: ['1', '5M', '1'],
        bone: ['5 - - - #4 - - -', '4 - - - #3 - - -', '#3 - - - - - . .'],
        dr: [{ t: 'x.......x.......' }, { t: 'x.......x.......' }, { p: 'x...............' }],
      },
      A: {
        chords: ['1', '6', '5M', '1', '4', '6', '5M', '5M'],
        lead: ['1 3 5 1\' . 7 6 5', '6 - 5 - 3 - 1 -', '2 - 5, - #7, - 2 -', '1 - - - . . . .', '4 - 6 - 1\' - 6 -', '3\' - 1\' - 6 - 3 -', '2 - #7, - 2 - 5 -', '#7, - - - . . . .'],
        pad: ['x---------------'], bass: ['1 - - - - - - -'],
      },
    },
    form: ['I', 'A'], loop: 1,
  },

  // ---------------------------------------------------------------------------------------- RESULTS
  // Score tally lounge: jazzy turnaround, walking bass, electric piano, vibes quoting the theme.
  results: {
    bpm: 112, key: 65, scale: 'major', swing: 0.16,
    parts: {
      lead: { type: 'mel', inst: 'glock', oct: 0, vol: 0.85, verb: 0.25 },
      comp: { type: 'chord', inst: 'epiano', oct: 0, vol: 0.5, verb: 0.2 },
      arp: { type: 'arp', inst: 'marimba', oct: 0, vol: 0.4 },
      bass: { type: 'bass', inst: 'bass', oct: -24, vol: 0.9 },
      dr: { type: 'drums', vol: 0.7 },
    },
    sections: {
      A: {
        chords: ['17', '67', '27', '57', '17', '67', '27', '57'],
        lead: ['3 - 5 - 7 - 6 5', '1 - - - . 3 4 5', '6 - 4 - 2 - 4 6', '5 - - - . . . .', '1 3 5 1\' . 7 6 5', '6 - - 5 6 - 1\' -', '2\' - 1\' - 6 - 4 -', '5 - - - 7 - . .'],
        comp: ['.x....x..x......'], bass: ['1 3 5 3', '1 5 3 5', '1 2 3 5', '1 3 5 7'], dr: ['brush'],
      },
      A2: {
        chords: ['17', '67', '27', '57', '17', '67', '27', '57'],
        arp: ['0 1 2 3 4 3 2 1'], comp: ['.x....x..x......'], bass: ['1 3 5 3', '1 5 3 5', '1 2 3 5', '1 3 5 7'], dr: ['brush', 'soft'],
      },
    },
    form: ['A', 'A2'], loop: 0,
  },

  // ----------------------------------------------------------------------------------------- ENDING
  // (bonus) Credits / ending story: the theme, slow and glowing, bells and choir.
  ending: {
    bpm: 88, key: 65, scale: 'major',
    parts: {
      lead: { type: 'mel', inst: 'bell', oct: 12, vol: 0.9, verb: 0.45 },
      horns: { type: 'mel', inst: 'brass', oct: -12, vol: 0.7, verb: 0.3 },
      arp: { type: 'arp', inst: 'harp', oct: 0, vol: 0.4, verb: 0.3 },
      choir: { type: 'chord', inst: 'choir', oct: 0, vol: 0.4, verb: 0.4 },
      bass: { type: 'bass', inst: 'bass', oct: -24, vol: 0.8 },
      dr: { type: 'drums', vol: 0.55 },
    },
    sections: {
      A: { chords: MOTIF_CHORDS, lead: MOTIF_A, arp: ['0 1 2 3 4 3 2 1'], choir: ['x-------'], bass: ['1 - - - 5 - - -'], dr: ['halftime'] },
      B: { chords: MOTIF_CHORDS, horns: MOTIF_A, arp: ['0 1 2 3 4 3 2 1'], choir: ['x-------'], bass: ['1 - - 5 8 - 5 -'], dr: ['soft'] },
    },
    form: ['A', 'B'], loop: 0,
  },
};

export const TRACK_NAMES = Object.keys(SONGS);
