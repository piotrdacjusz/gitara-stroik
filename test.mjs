// Sprawdzenie rdzenia: node test.mjs
import assert from 'node:assert/strict';
import { yin, najblizszaStruna, zKapodastrem, nazwaNuty, midiNaHz, centy, INSTRUMENTY } from './core.js';

const SR = 48000;
/** Bufor próbek: suma zadanych harmonicznych (mnożnik × amplituda). */
function sygnal(hz, harm = [[1, 1]], n = 4096) {
  const b = new Float32Array(n);
  for (let i = 0; i < n; i++)
    for (const [k, amp] of harm) b[i] += amp * Math.sin((2 * Math.PI * hz * k * i) / SR);
  return b;
}

// 1. Dokładność na całym zakresie: E2 (najgrubsza) → A4 (ukulele).
for (const hz of [82.41, 110, 146.83, 220, 329.63, 440, 659.26]) {
  const d = centy(yin(sygnal(hz), SR), hz);
  assert.ok(Math.abs(d) < 2, `${hz} Hz: błąd ${d.toFixed(2)} centa`);
}

// 2. Piezo CPX500: podstawowa stłumiona, grają harmoniczne. Nie wolno zgłosić oktawy wyżej.
const piezo = yin(sygnal(82.41, [[1, 0.05], [2, 1], [3, 0.8], [4, 0.6]]), SR);
assert.ok(Math.abs(centy(piezo, 82.41)) < 5, `piezo: ${piezo.toFixed(2)} Hz, oczekiwane ~82.41`);

// 3. Cisza i szum nie dają fałszywego odczytu.
assert.equal(yin(new Float32Array(4096), SR), -1);

// 4. Kapodaster przesuwa cały strój; Open D + kapo II = E A E H C# E brzmiących.
const openD = INSTRUMENTY['Yamaha CPX500 III — akustyk']['Open D (DADF#AD)'];
assert.deepEqual(zKapodastrem(openD, 2).map((s) => nazwaNuty(s.midi)),
  ['E2', 'H2', 'E3', 'G#3', 'H3', 'E4']);
assert.deepEqual(zKapodastrem(openD, 0), openD);

// 5. Dwunastka: 10 pozycji (4 pary oktawowe + 2 unisona), pary różnią się o oktawę.
const dw = INSTRUMENTY['HB CLJ-412E — 12-strunowa']['Standard E'];
assert.equal(dw.length, 10);
assert.equal(dw[1].midi - dw[0].midi, 12);

// 6. Wybór struny: 85 Hz przy stroju standardowym to rozstrojone E2, nie A2.
const std = INSTRUMENTY['Harley Benton VT — elektryk']['Standard E'];
const w = najblizszaStruna(85, std, 440);
assert.equal(nazwaNuty(w.struna.midi), 'E2');
assert.ok(w.centy > 0 && w.centy < 100, `centy: ${w.centy}`);

// 7. Kalibracja A4 przestawia cały strój — 442 Hz podnosi cel E2.
assert.ok(midiNaHz(40, 442) > midiNaHz(40, 440));

// 8. Ukulele z wysokim G: struna 1 brzmi wyżej od struny 2 (strój reentrant).
const uku = INSTRUMENTY['HB Kahuna-S — ukulele sopran']['GCEA (wysokie G)'];
assert.ok(uku[0].midi > uku[1].midi);

console.log('OK — 8 sprawdzeń przeszło');
