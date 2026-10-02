// Generator chwytów: liczy układy palców dla AKTUALNEGO stroju i kapodastra.
// Nie ma bazy gotowych chwytów — „C-dur w Open D z kapo na IV" nie stoi w żadnej tabelce.
// Czyste funkcje — bez DOM. Testy: test-akordy.mjs

import { NAZWY } from './core.js';

// Notacja polska: H = 11, B = 10 (czyli Bb). A# też 10.
const PRYMY = { C:0, D:2, E:4, F:5, G:7, A:9, H:11, B:10 };

/** Interwały typów akordów. Kolejność bez znaczenia, prym (0) zawsze pierwszy. */
export const TYPY = {
  '':      [0, 4, 7],        'm':    [0, 3, 7],
  '7':     [0, 4, 7, 10],    'm7':   [0, 3, 7, 10],
  'maj7':  [0, 4, 7, 11],    'm6':   [0, 3, 7, 9],
  '6':     [0, 4, 7, 9],     'sus2': [0, 2, 7],
  'sus4':  [0, 5, 7],        'add9': [0, 4, 7, 14],
  '9':     [0, 4, 7, 10, 14],'m9':   [0, 3, 7, 10, 14],
  'dim':   [0, 3, 6],        'aug':  [0, 4, 8],
  '5':     [0, 7],
};

/**
 * Parsuje nazwę akordu: "Am7", "C#", "Fmaj7", "H7", "D/F#".
 * @returns {{prym:number, typ:string, bas:number|null, nazwa:string}|null}
 */
export function parsujAkord(tekst) {
  const m = String(tekst).trim().match(/^([A-HB])([#b]?)(.*?)(?:\/([A-HB])([#b]?))?$/i);
  if (!m) return null;

  const stopien = (litera, znak) => {
    const p = PRYMY[litera.toUpperCase()];
    if (p === undefined) return null;
    return (p + (znak === '#' ? 1 : znak === 'b' ? -1 : 0) + 12) % 12;
  };

  const prym = stopien(m[1], m[2]);
  if (prym === null) return null;

  // "Cmaj7" vs "CM7" vs "Cmin" — sprowadzamy do kluczy TYPY.
  let typ = (m[3] || '')
    .replace(/^maj(?=7|9)/i, 'maj').replace(/^M(?=7|9)/, 'maj')
    .replace(/^min/i, 'm').replace(/^dur$/i, '').replace(/^moll$/i, 'm')
    .replace(/^MAJ/i, 'maj');
  if (!(typ in TYPY)) {
    const dopasowanie = Object.keys(TYPY).find((k) => k && k.toLowerCase() === typ.toLowerCase());
    if (dopasowanie === undefined) return null;
    typ = dopasowanie;
  }

  const bas = m[4] ? stopien(m[4], m[5]) : null;
  return { prym, typ, bas, nazwa: NAZWY[prym] + typ + (bas !== null ? '/' + NAZWY[bas] : '') };
}

/** Klasy wysokości akordu: [{pc, interwal, pomijalny}]. */
export function dzwiekiAkordu({ prym, typ }) {
  const interwaly = TYPY[typ];
  // W akordzie czterodźwiękowym czysta kwinta może wypaść — ucho jej nie szuka.
  // W dim/aug kwinta definiuje akord, więc nigdy.
  const kwintaPomijalna = interwaly.length >= 4 && interwaly.includes(7);
  return interwaly.map((i) => ({
    pc: (prym + i) % 12,
    interwal: i,
    pomijalny: kwintaPomijalna && i === 7,
  }));
}

/** Dwunastka: chwyt przyciska cały kurs, więc układ liczymy na 6 grubych strunach. */
export const kursyDoChwytow = (struny) => struny.filter((s) => !/oktawa/.test(s.opis || ''));

/**
 * Palcowanie układu: barré + numery palców.
 * @returns {{palce:number[], barre:{prog:number,od:number,do:number}|null, liczba:number}|null}
 *          null = układ niegrywalny (za dużo palców albo pusta struna pod barré).
 */
export function palcowanie(progi) {
  const przycisniete = progi.map((p, i) => ({ p, i })).filter((x) => x.p > 0);
  const palce = progi.map(() => 0);
  if (!przycisniete.length) return { palce, barre: null, liczba: 0 };

  const min = Math.min(...przycisniete.map((x) => x.p));
  const naMin = przycisniete.filter((x) => x.p === min).map((x) => x.i);

  let barre = null;
  if (naMin.length >= 2) {
    const od = naMin[0], doo = naMin[naMin.length - 1];
    // Palec leży płasko: wszystko między skrajnymi strunami musi być na tym progu
    // albo wyżej. Struna pusta pod palcem to fizyczna niemożliwość.
    const czysto = progi.slice(od, doo + 1).every((p) => p >= min || p === -1);
    if (czysto) barre = { prog: min, od, do: doo };
  }

  const reszta = przycisniete.filter((x) => !(barre && x.p === min));
  const liczba = (barre ? 1 : 0) + reszta.length;
  if (liczba > 4) return null;

  // Dwa palce na tym samym progu, przedzielone palcem stojącym WYŻEJ, da się ułożyć
  // tylko blisko siebie — tak wygląda zwykły kształt D (progi 2-3-2 na trzech strunach).
  // Rozjechane na pół gryfu wymagałyby skrzyżowania palców.
  // Barré jest wyjątkiem: to jeden palec, więc go ta reguła nie dotyczy.
  for (const prog of new Set(reszta.map((x) => x.p))) {
    const naTymProgu = reszta.filter((x) => x.p === prog).map((x) => x.i);
    for (let k = 1; k < naTymProgu.length; k++) {
      const [a, b] = [naTymProgu[k - 1], naTymProgu[k]];
      const wyzejMiedzy = progi.slice(a + 1, b).some((pr) => pr > prog);
      if (wyzejMiedzy && b - a > 2) return null;
    }
  }

  // Palec 1 na barré (albo na najniższym progu), dalej rosnąco wg progu.
  if (barre) naMin.forEach((i) => (palce[i] = 1));
  const kolejnosc = [...reszta].sort((a, b) => a.p - b.p || a.i - b.i);
  let nastepny = barre ? 2 : 1;
  const przypisane = new Map();
  for (const { p, i } of kolejnosc) {
    // Dwie struny na tym samym progu obok siebie biorą ten sam palec tylko przy barré,
    // poza tym każda dostaje własny.
    palce[i] = przypisane.get(p) ?? nastepny++;
    if (!przypisane.has(p) && !barre) przypisane.set(p, palce[i]);
    przypisane.delete(p);
  }
  return { palce, barre, liczba };
}

const iloczyn = (listy) =>
  listy.reduce((acc, lista) => acc.flatMap((k) => lista.map((v) => [...k, v])), [[]]);

/**
 * Układy palców dla akordu w zadanym stroju.
 * @param {Array<{midi:number}>} struny — już po kapodastrze; próg 0 = struna pusta (lub kapo)
 * @param {object} akord — wynik parsujAkord
 * @returns {Array} do `ile` układów: otwarty, kolejne pozycje w górę gryfu, na końcu przewroty
 */
export function generujChwyty(struny, akord, { maxPozycja = 11, ile = 6 } = {}) {
  const dzwieki = dzwiekiAkordu(akord);
  const wymagane = dzwieki.filter((d) => !d.pomijalny).map((d) => d.pc);
  const wszystkie = new Set(dzwieki.map((d) => d.pc));
  const minBrzmiacych = Math.min(struny.length, akord.typ === '5' ? 2 : 3);
  const basDocelowy = akord.bas ?? akord.prym;
  // Ukulele z wysokim G: struny nie idą od najniższej do najwyższej, a cały instrument
  // mieści się w oktawie. Przewrót nie jest tam pojęciem — który dźwięk wypadł najniżej,
  // jest kwestią stroju, nie wyboru gitarzysty.
  const reentrant = struny.some((s, i) => i > 0 && s.midi < struny[i - 1].midi);

  const kandydaci = [];
  const widziane = new Set();

  for (let pozycja = 0; pozycja <= maxPozycja; pozycja++) {
    const opcje = struny.map((s) => {
      const lista = [-1];                                   // struna wytłumiona
      for (let f = 0; f <= 4; f++) {
        const prog = pozycja === 0 ? f : f === 0 ? 0 : pozycja + f - 1;
        if (prog > pozycja + 3 && prog !== 0) continue;
        if (!lista.includes(prog) && wszystkie.has((s.midi + prog) % 12)) lista.push(prog);
      }
      return lista;
    });

    for (const progi of iloczyn(opcje)) {
      const brzmiace = progi.map((p, i) => ({ p, i })).filter((x) => x.p >= 0);
      if (brzmiace.length < minBrzmiacych) continue;

      // Wytłumiona struna w środku akordu — nie do zagrania czysto.
      const pierwsza = brzmiace[0].i, ostatnia = brzmiace[brzmiace.length - 1].i;
      if (progi.slice(pierwsza, ostatnia + 1).some((p) => p === -1)) continue;

      const obecne = new Set(brzmiace.map((x) => (struny[x.i].midi + x.p) % 12));
      if (!wymagane.every((pc) => obecne.has(pc))) continue;

      const przyciski = brzmiace.filter((x) => x.p > 0).map((x) => x.p);
      if (przyciski.length && Math.max(...przyciski) - Math.min(...przyciski) > 3) continue;

      const palcowane = palcowanie(progi);
      if (!palcowane) continue;

      const klucz = progi.join(',');
      if (widziane.has(klucz)) continue;
      widziane.add(klucz);

      // Bas to najniższy brzmiący dźwięk, nie pierwsza struna z brzegu — ukulele
      // z wysokim G ma strój reentrant i struna 1 bywa wyższa od struny 2.
      const dzwiek = (x) => struny[x.i].midi + x.p;
      const basMidi = dzwiek(brzmiace.reduce((a, b) => (dzwiek(a) <= dzwiek(b) ? a : b)));
      const basPc = basMidi % 12;
      // Tłumimy struny basowe, żeby zmienić bas — to normalny chwyt (x32010).
      // Wytłumienie struny brzmiącej wyżej od basu to po prostu stracony dźwięk.
      const stracone = progi.filter((p, i) => p === -1 && struny[i].midi >= basMidi).length;
      const najnizszy = przyciski.length ? Math.min(...przyciski) : 0;
      const rozpietosc = przyciski.length ? Math.max(...przyciski) - najnizszy : 0;
      const otwarty = progi.includes(0) && (!przyciski.length || Math.max(...przyciski) <= 4);

      kandydaci.push({
        progi, ...palcowane, otwarty,
        pozycja: najnizszy,
        bas: basPc,
        przewrot: !reentrant && basPc !== basDocelowy,
        pelny: wszystkie.size === obecne.size,
        ocena:
          brzmiace.length * 1.2 +
          progi.filter((p) => p === 0).length * 1.5 +
          (4 - palcowane.liczba) * 1.2 +
          (wszystkie.size === obecne.size ? 3 : 0) -
          rozpietosc * 1.1 -               // rozciągnięta łapa męczy bardziej niż dodatkowy palec
          (palcowane.barre ? 1.2 : 0) -    // barré kosztuje mniej więcej jeden palec
          stracone * 2 -
          // Ręka w pozycji otwartej nigdzie się nie przenosi, choćby jeden palec sięgał
          // trzeciego progu. Dopiero chwyt bez pustych strun kosztuje wędrówkę po gryfie.
          najnizszy * (otwarty ? 0.35 : 1.3),
      });
    }
  }

  // Pierwszy jest po prostu najwygodniejszy układ, jaki w tym stroju istnieje.
  // Dalej po jednym najlepszym z każdej kolejnej pozycji w górę gryfu.
  const bezPrzewrotow = kandydaci.filter((k) => !k.przewrot).sort((a, b) => b.ocena - a.ocena);
  const glowne = [];
  if (bezPrzewrotow.length) {
    const najlepszy = bezPrzewrotow[0];
    const wyzej = new Map();
    for (const k of bezPrzewrotow) {
      if (k.pozycja <= najlepszy.pozycja) continue;
      const poprzedni = wyzej.get(k.pozycja);
      if (!poprzedni || k.ocena > poprzedni.ocena) wyzej.set(k.pozycja, k);
    }
    glowne.push(najlepszy, ...[...wyzej.values()].sort((a, b) => a.pozycja - b.pozycja));
  }

  // Przewroty na koniec — po jednym na każdy dźwięk w basie.
  const przewroty = new Map();
  for (const k of kandydaci.filter((k) => k.przewrot && k.pelny)) {
    const poprzedni = przewroty.get(k.bas);
    if (!poprzedni || k.ocena > poprzedni.ocena) przewroty.set(k.bas, k);
  }
  const dodatki = [...przewroty.values()].sort((a, b) => b.ocena - a.ocena).slice(0, 2);

  return [...glowne.slice(0, Math.max(1, ile - dodatki.length)), ...dodatki]
    .slice(0, ile)
    .map((k) => ({
      ...k,
      opis: k.przewrot ? `${NAZWY[akord.prym]}${akord.typ}/${NAZWY[k.bas]}`
           : k.otwarty ? 'pozycja otwarta' : `pozycja ${k.pozycja}`,
    }));
}
