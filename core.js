// Rdzeń stroika: nuty, stroje, kapodaster, detekcja wysokości (YIN).
// Czyste funkcje — bez DOM, bez Web Audio. Testy: test.mjs

export const NAZWY = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'H'];

export const midiNaHz = (midi, a4 = 440) => a4 * 2 ** ((midi - 69) / 12);
export const centy = (hz, hzRef) => 1200 * Math.log2(hz / hzRef);

/** Nazwa nuty z numeru MIDI, np. 40 → "E2" (notacja H; B = A#). */
export function nazwaNuty(midi) {
  return NAZWY[((midi % 12) + 12) % 12] + (Math.floor(midi / 12) - 1);
}

// Struna = { midi, opis }. Opis dopisuje tylko to, czego nie widać z nazwy nuty
// (który kurs dwunastki, ile strun w unisonie).
const s = (midi, opis = '') => ({ midi, opis });

// 6-strunowe: E2 A2 D3 G3 B3 E4 = 40 45 50 55 59 64
const SZEŚĆ = {
  'Standard E': [40, 45, 50, 55, 59, 64].map((m) => s(m)),
  'Eb (pół tonu niżej)': [39, 44, 49, 54, 58, 63].map((m) => s(m)),
  'Drop D': [38, 45, 50, 55, 59, 64].map((m) => s(m)),
  'Open D (DADF#AD)': [38, 45, 50, 54, 57, 62].map((m) => s(m)),
  'DADGAD': [38, 45, 50, 55, 57, 62].map((m) => s(m)),
  'Open G (DGDGHD)': [38, 43, 50, 55, 59, 62].map((m) => s(m)),
};

// Dwunastka: 4 grube kursy to pary oktawowe (każdą strunę stroisz osobno),
// 2 cienkie to unisono (stroik ich nie rozróżni — stąd "×2").
const dwanaście = (przes) => [
  s(40 + przes, '6 · gruba'), s(52 + przes, '6 · oktawa'),
  s(45 + przes, '5 · gruba'), s(57 + przes, '5 · oktawa'),
  s(50 + przes, '4 · gruba'), s(62 + przes, '4 · oktawa'),
  s(55 + przes, '3 · gruba'), s(67 + przes, '3 · oktawa'),
  s(59 + przes, '2 · unisono ×2'),
  s(64 + przes, '1 · unisono ×2'),
];

export const INSTRUMENTY = {
  'Yamaha CPX500 III — akustyk': SZEŚĆ,
  'Harley Benton VT — elektryk': SZEŚĆ,
  'HB CLJ-412E — 12-strunowa': {
    'Standard E': dwanaście(0),
    'Eb (pół tonu niżej)': dwanaście(-1),
    'D (cały ton niżej)': dwanaście(-2),
  },
  'HB Kahuna-S — ukulele sopran': {
    'GCEA (wysokie G)': [s(67, 'wyższe od C'), s(60), s(64), s(69)],
    'GCEA (niskie G)': [s(55), s(60), s(64), s(69)],
    'ADF#H (strój starszy)': [s(69), s(62), s(66), s(71)],
  },
};

/** Kapodaster podnosi każdą strunę o tyle półtonów, na którym progu siedzi. */
export const zKapodastrem = (struny, prog) =>
  struny.map((st) => ({ ...st, midi: st.midi + prog }));

/**
 * Najbliższa struna do zmierzonej częstotliwości.
 * @returns {{nr: number, struna: object, hzCel: number, centy: number}}
 */
export function najblizszaStruna(hz, struny, a4 = 440) {
  let nr = 0;
  let naj = Infinity;
  struny.forEach((st, i) => {
    const d = Math.abs(centy(hz, midiNaHz(st.midi, a4)));
    if (d < naj) { naj = d; nr = i; }
  });
  const hzCel = midiNaHz(struny[nr].midi, a4);
  return { nr, struna: struny[nr], hzCel, centy: centy(hz, hzCel) };
}

/**
 * YIN — detekcja wysokości z bufora próbek.
 * Znormalizowana funkcja różnicy: nie myli się o oktawę nawet przy słabej
 * składowej podstawowej (czyli tak, jak brzmi piezo w CPX500).
 * @returns {number} Hz albo -1, gdy za cicho / brak wyraźnej wysokości.
 */
export function yin(buf, sr, { prog = 0.12, hzMin = 60, hzMax = 1300, cisza = 0.006 } = {}) {
  let suma = 0;
  for (let i = 0; i < buf.length; i++) suma += buf[i] * buf[i];
  if (Math.sqrt(suma / buf.length) < cisza) return -1;

  const tauMax = Math.min(Math.floor(sr / hzMin), buf.length >> 1);
  const tauMin = Math.max(2, Math.floor(sr / hzMax));
  if (tauMax <= tauMin) return -1;

  const okno = buf.length - tauMax;
  const cmnd = new Float32Array(tauMax + 1);
  let biegnaca = 0;

  for (let tau = 1; tau <= tauMax; tau++) {
    let d = 0;
    for (let i = 0; i < okno; i++) {
      const r = buf[i] - buf[i + tau];
      d += r * r;
    }
    biegnaca += d;
    cmnd[tau] = biegnaca === 0 ? 1 : (d * tau) / biegnaca;
  }

  // Pierwsze minimum pod progiem; brak → globalne minimum w zakresie.
  let tau = -1;
  for (let t = tauMin; t < tauMax; t++) {
    if (cmnd[t] < prog) {
      while (t + 1 < tauMax && cmnd[t + 1] < cmnd[t]) t++;
      tau = t;
      break;
    }
  }
  if (tau < 0) {
    let naj = Infinity;
    for (let t = tauMin; t < tauMax; t++) if (cmnd[t] < naj) { naj = cmnd[t]; tau = t; }
    if (naj > 0.5) return -1;
  }

  // Paraboliczna interpolacja wierzchołka — bez niej błąd sięga kilku centów.
  const a = cmnd[tau - 1], b = cmnd[tau], c = cmnd[tau + 1] ?? b;
  const miano = 2 * (2 * b - a - c);
  const tauDokl = miano === 0 ? tau : tau + (c - a) / miano;

  return sr / tauDokl;
}
