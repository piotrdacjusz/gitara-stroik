// Kontrola generatora chwytów: node test-akordy.mjs
import assert from 'node:assert/strict';
import { INSTRUMENTY, zKapodastrem, NAZWY } from './core.js';
import { parsujAkord, generujChwyty, palcowanie, dzwiekiAkordu, kursyDoChwytow } from './akordy.js';

const std = INSTRUMENTY['Yamaha CPX500 III — akustyk']['Standard E'];
const uklad = (p) => p.map((x) => (x < 0 ? 'x' : x)).join('-');

// 1. Parser: notacja polska (H = 11, B = Bb = 10), przewroty, warianty zapisu.
assert.equal(parsujAkord('C').prym, 0);
assert.equal(parsujAkord('H7').prym, 11);
assert.equal(parsujAkord('B').prym, 10);
assert.equal(parsujAkord('A#').prym, 10);
assert.equal(parsujAkord('Am7').typ, 'm7');
assert.equal(parsujAkord('Cmin').typ, 'm');
assert.equal(parsujAkord('FMAJ7').typ, 'maj7');
assert.equal(parsujAkord('D/F#').bas, 6);
assert.equal(parsujAkord('Qx7'), null);

// 2. Dźwięki akordu: kwinta pomijalna dopiero w czterodźwiękach, nigdy w dim.
assert.deepEqual(dzwiekiAkordu(parsujAkord('C')).map((d) => d.pc), [0, 4, 7]);
assert.ok(dzwiekiAkordu(parsujAkord('G7')).find((d) => d.interwal === 7).pomijalny);
assert.ok(!dzwiekiAkordu(parsujAkord('C')).find((d) => d.interwal === 7).pomijalny);
assert.ok(!dzwiekiAkordu(parsujAkord('Cdim')).some((d) => d.pomijalny));

// 3. Palcowanie: barré, limit czterech palców, pusta struna pod palcem.
assert.equal(palcowanie([1, 3, 3, 2, 1, 1]).barre.prog, 1);          // F
assert.equal(palcowanie([1, 3, 3, 2, 1, 1]).liczba, 4);
assert.equal(palcowanie([-1, 3, 2, 0, 1, 0]).barre, null);           // C
assert.deepEqual(palcowanie([-1, 3, 2, 0, 1, 0]).palce, [0, 3, 2, 0, 1, 0]);
assert.equal(palcowanie([1, 0, 1, 1, 1, 1]), null);                  // pusta struna pod barré → pięć palców
assert.equal(palcowanie([1, 2, 3, 4, 2, 0]), null);                  // pięć palców — nie da się

// 4. KAŻDY zwrócony układ musi być zagrywalny i zawierać wszystkie dźwięki akordu.
//    To jest ważniejsze niż zgodność ze śpiewnikiem.
const NAZWY_TESTOWE = ['C','G','D','A','E','Am','Em','Dm','F','H','F#m','A7','D7','Cmaj7','Am7','Em7',
                       'Dsus4','Csus2','Gadd9','Edim','Caug','C9','A5','D/F#','C/G'];
for (const nazwa of NAZWY_TESTOWE) {
  const akord = parsujAkord(nazwa);
  assert.ok(akord, `parser nie zna ${nazwa}`);
  const chwyty = generujChwyty(std, akord);
  assert.ok(chwyty.length >= 1, `brak układów dla ${nazwa}`);

  const wymagane = dzwiekiAkordu(akord).filter((d) => !d.pomijalny).map((d) => d.pc);
  for (const ch of chwyty) {
    const etykieta = `${nazwa} ${uklad(ch.progi)}`;
    const brzmiace = ch.progi.map((p, i) => ({ p, i })).filter((x) => x.p >= 0);
    const obecne = new Set(brzmiace.map((x) => (std[x.i].midi + x.p) % 12));
    for (const pc of wymagane)
      assert.ok(obecne.has(pc), `${etykieta}: brakuje dźwięku ${NAZWY[pc]}`);

    assert.ok(ch.liczba <= 4, `${etykieta}: ${ch.liczba} palców`);
    const przyciski = brzmiace.filter((x) => x.p > 0).map((x) => x.p);
    if (przyciski.length)
      assert.ok(Math.max(...przyciski) - Math.min(...przyciski) <= 3, `${etykieta}: za szeroko`);

    const od = brzmiace[0].i, doo = brzmiace[brzmiace.length - 1].i;
    assert.ok(!ch.progi.slice(od, doo + 1).includes(-1), `${etykieta}: wytłumiona struna w środku`);
    assert.ok(brzmiace.length >= (akord.typ === '5' ? 2 : 3), `${etykieta}: za mało strun`);
  }
  // Pozycje rosną w górę gryfu, bez powtórek.
  const glowne = chwyty.filter((c) => !c.przewrot).map((c) => c.pozycja);
  assert.deepEqual(glowne, [...glowne].sort((a, b) => a - b), `${nazwa}: pozycje nieuporządkowane`);
}

// 5. Kanon śpiewnikowy na pierwszym miejscu.
const KANON = { C:'x-3-2-0-1-0', G:'3-2-0-0-0-3', D:'x-x-0-2-3-2', A:'x-0-2-2-2-0', E:'0-2-2-1-0-0',
  Am:'x-0-2-2-1-0', Em:'0-2-2-0-0-0', Dm:'x-x-0-2-3-1', F:'1-3-3-2-1-1', A7:'x-0-2-0-2-0',
  D7:'x-x-0-2-1-2', E7:'0-2-0-1-0-0', G7:'3-2-0-0-0-1', Cmaj7:'x-3-2-0-0-0', Am7:'x-0-2-0-1-0',
  Em7:'0-2-0-0-0-0' };
for (const [nazwa, wzor] of Object.entries(KANON)) {
  const pierwszy = uklad(generujChwyty(std, parsujAkord(nazwa))[0].progi);
  assert.equal(pierwszy, wzor, `${nazwa}: dostałem ${pierwszy}`);
}

// 6. Kapodaster: wpisujesz akord BRZMIĄCY, dostajesz kształt liczony od kapo.
//    Niezmiennik: akord X z kapo na N progu ma ten sam kształt co akord o N półtonów
//    niższy bez kapo. Z kapo na II D gra się kształtem C, E kształtem D, G kształtem F.
for (const [prog, brzmiacy, ksztalt] of [[2,'D','C'], [2,'E','D'], [2,'G','F'], [4,'E','C'], [5,'A','E'], [7,'G','C']]) {
  assert.equal(
    uklad(generujChwyty(zKapodastrem(std, prog), parsujAkord(brzmiacy))[0].progi),
    uklad(generujChwyty(std, parsujAkord(ksztalt))[0].progi),
    `kapo ${prog}: ${brzmiacy} powinien mieć kształt ${ksztalt}`);
}

// 7. Strój otwarty robi swoje: w Open D z kapo na IV progu C-dur to jedno barré.
const openD4 = zKapodastrem(INSTRUMENTY['Yamaha CPX500 III — akustyk']['Open D (DADF#AD)'], 4);
const cWOpenD = generujChwyty(openD4, parsujAkord('C'));
assert.ok(cWOpenD.some((c) => c.barre && c.liczba === 1 && uklad(c.progi) === '6-6-6-6-6-6'),
  'Open D + kapo IV: C-dur powinno wyjść jednym barré');

// 8. Dwunastka: chwyt przyciska kurs, więc układ liczymy na sześciu grubych strunach.
const dw = kursyDoChwytow(INSTRUMENTY['HB CLJ-412E — 12-strunowa']['Standard E']);
assert.equal(dw.length, 6);
assert.equal(uklad(generujChwyty(dw, parsujAkord('G'))[0].progi), '3-2-0-0-0-3');

// 9. Ukulele: cztery struny, własne układy. C-dur to jeden palec.
const uku = INSTRUMENTY['HB Kahuna-S — ukulele sopran']['GCEA (wysokie G)'];
assert.equal(uklad(generujChwyty(uku, parsujAkord('C'))[0].progi), '0-0-0-3');
assert.equal(uklad(generujChwyty(uku, parsujAkord('F'))[0].progi), '2-0-1-0');
assert.equal(uklad(generujChwyty(uku, parsujAkord('Am'))[0].progi), '2-0-0-0');

// 10. Przewroty trafiają na koniec listy i mają bas inny niż prym.
const zPrzewrotami = generujChwyty(std, parsujAkord('C'));
const pierwszyPrzewrot = zPrzewrotami.findIndex((c) => c.przewrot);
if (pierwszyPrzewrot >= 0) {
  assert.ok(zPrzewrotami.slice(pierwszyPrzewrot).every((c) => c.przewrot), 'przewroty wymieszane');
  assert.ok(zPrzewrotami[pierwszyPrzewrot].bas !== 0);
}

console.log(`OK — ${NAZWY_TESTOWE.length} akordów sprawdzonych na grywalność, kanon ${Object.keys(KANON).length}/${Object.keys(KANON).length}`);
