/* MusicGrid — the instruments the mascots play on the lyrics stage,
 * original pixel art in the mascots' own style (one colour per pixel,
 * drawn in lola's coordinates: her centre line is x 9.5, the face y 1–9,
 * the chest y 9–17, the hips y 17–21, the feet end at y 30; her shoulders
 * turn at (4, 11) and (16, 11) and a hanging hand is at (4, 18.5)).
 *
 *   MGInstruments.ids                    every instrument id (a live array)
 *   MGInstruments.sprite(id, opts)       { back, front?, stage? } rect markup, or null
 *        back   behind the arms, in front of the chest (held: moves with the torso)
 *        front  over the arms (a neck or a hand on top), under the head
 *        stage  a floor kit (drums): in front of the legs, behind the body
 *        opts.dx / opts.dy  shift it (MGMascots passes the mascot's def.hold)
 *   MGInstruments.forSong(genre, country) the ids a song's dancer may play ([] = none)
 *   MGInstruments.register(id, def)      add one: def.draw(P, spec, dx, dy) →
 *        { back, front?, stage? }; def.genres: the genres it suits;
 *        def.countries: countries that add it to any song (except the
 *        genres in MODERN); def.pairs: { country: [genres] } that add it
 *        only for those genres; def.pal: colours
 *
 * Things held IN a hand (drumsticks, the bow, maracas, the mic, a plectrum)
 * are drawn hanging from a hanging hand and wrapped in
 * <g class="held held-l|held-r">: instruments.css turns them with the arm
 * about the shoulder, so they stay in the hand whatever the arm does.
 *
 * MGMascots.figure(name, 'front', v, { instrument: id }) puts the layers in
 * the skeleton as <g class="instrument inst-back|inst-front|inst-stage
 * inst-<id>">; dancer.js picks the 'play' move (class "mv-play inst-<id>")
 * and assets/css/instruments.css moves the arms for each one.
 * Loads after mascots.js (and the mascot-*.js files), before dancer.js.
 */
(function () {
    'use strict';

    /* runs [y, x, 'letters'] → <rect>s, shifted by dx/dy ('.' = none) */
    function spec(runs, colour, dx, dy) {
        let out = '';
        runs.forEach(function (r) {
            const y = r[0] + dy, x0 = r[1] + dx, str = r[2];
            let x = 0;
            while (x < str.length) {
                const c = str[x] === '.' ? null : colour(str[x]);
                if (!c) { x++; continue; }
                let end = x + 1;
                while (end < str.length && str[end] !== '.' && colour(str[end]) === c) end++;
                out += '<rect x="' + (x0 + x) + '" y="' + y + '" width="' + (end - x) + '" height="1" fill="' + c + '"/>';
                x = end;
            }
        });
        return out;
    }

    /* A pixel sheet: put / rows / line / neck paint letters on a grid
       (later paint wins), runs() hands them to spec() */
    function Sheet() { this.px = new Map(); }
    Sheet.prototype.put = function (x, y, ch) { this.px.set(x + ',' + y, [x, y, ch]); return this; };
    /* rows of letters from (ox, oy), '.' = leave */
    Sheet.prototype.rows = function (ox, oy, rows) {
        rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r[i] !== '.') this.put(ox + i, oy + j, r[i]); });
        return this;
    };
    /* a one-pixel line (Bresenham) */
    Sheet.prototype.line = function (x0, y0, x1, y1, ch) {
        const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
        let err = dx + dy;
        for (;;) {
            this.put(x0, y0, ch);
            if (x0 === x1 && y0 === y1) break;
            const e2 = 2 * err;
            if (e2 >= dy) { err += dy; x0 += sx; }
            if (e2 <= dx) { err += dx; y0 += sy; }
        }
        return this;
    };
    /* a fretted neck running left from x (its first pixel x - 1), the
       fingerboard row at y over its edge row y + 1, climbing a pixel every
       `step`; a fret every `every` pixels. → the end { x, y } (the next
       pixel to the left, the fingerboard row there) */
    Sheet.prototype.neck = function (x, y, len, o) {
        o = o || {};
        const step = o.step || 4, every = o.every || 3;
        let i = 0;
        for (; i < len; i++) {
            const px = x - 1 - i, py = y - Math.floor(i / step);
            this.put(px, py, (i % every === every - 1) ? (o.fret || 'm') : (o.top || 'F'));
            this.put(px, py + 1, o.edge || 'N');
        }
        return { x: x - 1 - len, y: y - Math.floor(len / step) };
    };
    Sheet.prototype.runs = function () {
        const byY = new Map();
        this.px.forEach(p => { if (!byY.has(p[1])) byY.set(p[1], []); byY.get(p[1]).push(p); });
        const out = [];
        Array.from(byY.keys()).sort((a, b) => a - b).forEach(y => {
            const row = byY.get(y).sort((a, b) => a[0] - b[0]);
            const x0 = row[0][0];
            let s = '';
            row.forEach(p => { while (x0 + s.length < p[0]) s += '.'; s += p[2]; });
            out.push([y, x0, s]);
        });
        return out;
    };
    /* sheet → rect markup in palette P */
    const paint = (S, P, dx, dy) => spec(S.runs(), ch => P[ch], dx, dy);
    /* a held thing, turned with the arm by instruments.css */
    const held = (side, markup) => markup ? '<g class="held held-' + side + '">' + markup + '</g>' : '';

    const IDS = [];
    const DEFS = {};
    function register(id, def) {
        DEFS[id] = def;
        if (IDS.indexOf(id) < 0) IDS.push(id);
    }

    const O = '#1a1012';   /* the outline every sprite shares */

    /* a strap over the chest from the left shoulder down to the body */
    function strap(S, x1, y1) { S.line(6, 10, x1, y1, 's'); }

    /* ── electric guitar: slung low across the hips ─────────────
       The body rests on the right hip (x 8–17, y 16–23) where the right
       hand strums; the neck climbs to the left to the headstock at x -6
       where the left hand frets. */
    register('guitar', {
        genres: ['rock', 'metal', 'punkska', 'indie', 'pop', 'citypop', 'funksoul'],
        pal: { o: O, R: '#d0283c', r: '#a01c2c', w: '#f4f0e8', p: '#2a2a30', F: '#6a4424', N: '#c8925a',
               H: '#26262c', m: '#d8d8e0', l: '#e8e8ee', k: '#f0c850', s: '#3a2a22' },
        draw: function (P, sp, dx, dy) {
            const S = new Sheet();
            strap(S, 9, 16);
            const end = S.neck(8, 19, 11);
            /* the headstock, three tuners on top */
            S.rows(end.x - 2, end.y - 2, ['m.m.', 'HHHH', 'oHH.']);
            /* two horns and a cutaway; the strings run on from the neck
               over two upright pickups to the bridge; a pickguard below and
               two knobs */
            S.rows(8, 16, [
                '..ooo.ooo.',
                '.oRRRoRRRo',
                'oRRRRRRRRo',
                'oRRpRpRRro',
                'lllplpmRro',
                'owwpwpwkro',
                '.owwwwkro.',
                '..oooooo..',
            ]);
            return { back: paint(S, P, dx, dy) };
        },
    });

    /* ── acoustic guitar: a round two-bout body with a sound hole ── */
    register('acoustic', {
        genres: ['folk', 'americana', 'latin', 'indie', 'pop', 'soundtrack'],
        pal: { o: '#2a160c', W: '#e8b86a', w: '#c99550', h: '#20140c', r: '#7a4a24', b: '#5a3418', l: '#f4ecd8',
               F: '#3a2418', N: '#e0c088', m: '#d8d8e0', H: '#4a2c18', s: '#5a3a22' },
        draw: function (P, sp, dx, dy) {
            const S = new Sheet();
            strap(S, 8, 15);
            const end = S.neck(6, 19, 11);
            S.rows(end.x - 2, end.y - 2, ['m.m.', 'HHHH', 'oHH.']);
            /* upper bout (by the neck) smaller, the waist, the lower bout;
               the hole ringed by the rosette, the strings to the bridge */
            S.rows(5, 15, [
                '..oooo...oooo.',
                '.oWWWWo.oWWWWo',
                'oWWWWWWoWWWWWWo',
                'oWWrrrWWWWWWWWo',
                'lllrhhrllllllbo',
                'oWWrhhrWWWWWbwo',
                'oWWWrrWWWWWWWwo',
                '.owWWWWoWWWWwo.',
                '..oooo..ooooo..',
            ]);
            return { back: paint(S, P, dx, dy) };
        },
    });

    /* ── bass guitar: a longer neck, an offset blue body ─────────── */
    register('bass', {
        genres: ['rock', 'metal', 'punkska', 'funksoul', 'jazz', 'citypop', 'indie'],
        pal: { o: O, B: '#2c5aa8', b: '#1c3a74', g: '#ece6da', p: '#1a1a1e', F: '#5a3a20', N: '#dcb07a',
               H: '#202024', m: '#d8d8e0', l: '#e8e8ee', s: '#2a2a30' },
        draw: function (P, sp, dx, dy) {
            const S = new Sheet();
            strap(S, 10, 16);
            const end = S.neck(10, 19, 15);
            /* a long headstock, four tuners */
            S.rows(end.x - 3, end.y - 2, ['m.m.m', 'HHHHH', '.oHH.']);
            /* two horns (the upper one longer), the pickguard round the
               split pickup, the bridge */
            S.rows(10, 14, [
                '.oo.........',
                'oBBo....oo..',
                'oBBBo..oBBo.',
                'oBBBBooBBBo.',
                'oBgggggBBBBo',
                'lllgpplllmbo',
                'oBgggggBBBbo',
                'oBBBBBBBBbbo',
                '.oBBBBBBbbo.',
                '..oooooooo..',
            ]);
            return { back: paint(S, P, dx, dy) };
        },
    });

    /* ── banjo: a round drum head on a metal rim, a long neck with the
       short fifth string's peg half way up ───────────────────────── */
    register('banjo', {
        genres: ['americana'],
        pairs: { usa: ['folk'], canada: ['folk'] },
        pal: { o: O, w: '#f6f2e6', W: '#ddd6c4', m: '#c8c8d0', M: '#8a8a96', b: '#6a4424', l: '#bcbcc4',
               F: '#4a2c1a', N: '#c8925a', H: '#4a2c1a', t: '#e8e8ee', s: '#4a3020' },
        draw: function (P, sp, dx, dy) {
            const S = new Sheet();
            strap(S, 9, 15);
            const end = S.neck(9, 19, 13);
            S.rows(end.x - 2, end.y - 2, ['t.t.', 'HHHH', 'oHH.']);
            S.put(2, 16, 't');   /* the fifth string's peg */
            S.rows(8, 15, [
                '..ooooooo..',
                '.oMmmmmmMo.',
                'oMwwwwwwwMo',
                'oMwwwwwwWMo',
                'llllllbllMo',
                'oMwwwwbwWMo',
                'oMwwwwwwWMo',
                'oMWwwwwWWMo',
                '.oMMmmmMMo.',
                '..ooooooo..',
            ]);
            return { back: paint(S, P, dx, dy) };
        },
    });

    /* ── ukulele: small, held high, a short neck ────────────────── */
    register('ukulele', {
        genres: [],
        countries: [],   /* Hawaii isn't a catalog country: usa pairs below */
        pairs: { usa: ['folk', 'indie', 'pop'], newzealand: ['folk', 'indie', 'pop'] },
        pal: { o: '#3a2010', W: '#d89a58', w: '#b87a3c', h: '#2a160a', r: '#f4e0b8', b: '#5a3418', l: '#f4ecd8',
               F: '#3a2418', N: '#d89a58', m: '#e8e0d0', H: '#3a2418' },
        draw: function (P, sp, dx, dy) {
            const S = new Sheet();
            const end = S.neck(9, 19, 9, { every: 2 });
            S.rows(end.x - 2, end.y - 1, ['m.m', 'HHH', 'oH.']);
            S.rows(8, 16, [
                '.ooo..ooo.',
                'oWWWooWWWo',
                'oWrrWWWWwo',
                'lrhhrllbwo',
                'oWrrWWWbwo',
                'oWWWooWWwo',
                '.ooo..ooo.',
            ]);
            return { back: paint(S, P, dx, dy) };
        },
    });

    /* ── cuatro (Venezuela, Puerto Rico): a small four-string guitar ── */
    register('cuatro', {
        genres: [],
        countries: ['venezuela', 'puertorico'],
        pairs: { colombia: ['latin', 'folk'] },
        pal: { o: '#2a140a', W: '#b8682c', w: '#8a4a1e', h: '#1e0e06', r: '#f0d8a8', b: '#3a1c0c', l: '#f4ecd8',
               F: '#2a1a10', N: '#b8682c', m: '#e8e0d0', H: '#3a1c0c' },
        draw: function (P, sp, dx, dy) {
            const S = new Sheet();
            const end = S.neck(8, 18, 9);
            S.rows(end.x - 2, end.y - 2, ['m.m.', 'HHHH', 'oH..']);
            S.rows(7, 15, [
                '..ooo..ooo.',
                '.oWWWooWWWo',
                'oWWrrWWWWWwo',
                'lllrhrllllbo',
                'oWWrrWWWWbwo',
                'oWWWWWWWWWwo',
                '.oWWWooWWwo.',
                '..ooo..ooo..',
            ]);
            return { back: paint(S, P, dx, dy) };
        },
    });

    /* ── guitarrón (mariachi bass, Mexico): a big deep body held high
       on the chest, a pale top bound in dark wood, a short neck ─── */
    register('guitarron', {
        genres: [],
        countries: ['mexico'],
        pal: { o: '#1e0e06', W: '#ecc488', w: '#cfa060', d: '#9a5a2a', h: '#1a0c06', r: '#d8a868', b: '#2a1408',
               l: '#f4ecd8', F: '#2a1a10', N: '#ecc488', m: '#e8e0d0', H: '#3a1a0c' },
        draw: function (P, sp, dx, dy) {
            const S = new Sheet();
            const end = S.neck(5, 17, 6, { every: 2 });
            S.rows(end.x - 3, end.y - 2, ['m.m.', 'HHHH', 'HHH.', 'oo..']);
            S.rows(5, 12, [
                '...oooooooo....',
                '..odWWWWWWWdo..',
                '.odWWWWWWWWWdo.',
                'odWWWWWWWWWWWdo',
                'odWWWrrrWWWWWdo',
                'lllWrhhhrlllllo',
                'odWWrhhhrWWWbdo',
                'odWWWrrrWWWWbdo',
                'odWWWWWWWWWWWdo',
                'odwWWWWWWWWWwdo',
                '.odwWWWWWWWwdo.',
                '..oddddddddddo..',
                '...oooooooooo..',
            ]);
            return { back: paint(S, P, dx, dy) };
        },
    });

    /* ── balalaika (Russia): the triangle body, three strings ────── */
    register('balalaika', {
        genres: [],
        countries: ['russia'],
        pal: { o: '#2a140a', W: '#e8c07a', w: '#c89850', R: '#b8282c', h: '#2a160a', b: '#4a2410', l: '#f4ecd8',
               F: '#2a1a10', N: '#c89850', m: '#e8e0d0', H: '#b8282c' },
        draw: function (P, sp, dx, dy) {
            const S = new Sheet();
            const end = S.neck(6, 17, 10, { step: 3 });
            S.rows(end.x - 2, end.y - 2, ['m.m', 'HHH', 'oHH']);
            /* the point by the neck, the flat end on the right, a red edge */
            S.rows(6, 12, [
                '...........ooo',
                '.........ooWRo',
                '.......ooWWWRo',
                '.....ooWWWWWRo',
                '....oWWWWWWWRo',
                '..ooWWWWhWWWRo',
                'llllllhhhlllbo',
                '..ooWWWWhWWWbo',
                '....oWWWWWWWRo',
                '.....ooWWWWWRo',
                '.......ooWWWRo',
                '.........ooWwo',
                '...........ooo',
            ]);
            return { back: paint(S, P, dx, dy) };
        },
    });

    /* ── shamisen (Japan): a small square body with a pale skin, a long
       slim neck held steep, plucked with a big bachi (in the right hand) ── */
    register('shamisen', {
        genres: [],
        countries: ['japan'],
        pal: { o: O, w: '#f4efe2', W: '#ddd4c0', d: '#4a2414', D: '#2e160c', l: '#e8e0cc', N: '#5a2e18', F: '#3a1c0e',
               m: '#3a1c0e', H: '#2e160c', p: '#f0e8d0', r: '#b8282c', b: '#e8dcc0', B: '#b8a888' },
        draw: function (P, sp, dx, dy) {
            const S = new Sheet();
            /* the neck: plain (no frets), climbing a pixel every two */
            const end = S.neck(10, 18, 13, { step: 2, every: 99 });
            /* the tenjin bent back, three pegs */
            S.rows(end.x - 1, end.y - 3, ['p.', 'Hp', 'HH', 'pH']);
            /* the dō: a rounded square, a red cord at the bottom */
            S.rows(10, 15, [
                '.ooooooo.',
                'odwwwwwDo',
                'odwwwwwDo',
                'llllllwDo',
                'odwwwwwDo',
                'odWwwwWDo',
                'oDDDDDDDo',
                '.ooorooo.',
            ]);
            /* the bachi: a wide fan blade on a short grip, in the right hand
               (drawn as the arm stands at 25deg; instruments.css turns it
               with the arm) */
            const B = new Sheet().rows(10, 16, ['...B', '..bB', '.bbb.', 'bbbb.', 'oooo.']);
            return { back: paint(S, P, dx, dy), front: held('r', paint(B, P, dx, dy)) };
        },
    });

    /* ── violin: under the chin on the left shoulder, the neck out to
       the left hand; the bow in the right hand ───────────────────── */
    register('violin', {
        genres: ['classical', 'baroquepop', 'folk', 'soundtrack'],
        countries: ['romania'],
        pal: { o: '#1e0c04', W: '#c8661e', w: '#9a4612', h: '#2a1206', F: '#141014', p: '#f0d8a8', D: '#5a2a0e',
               l: '#ece4d0', b: '#5a3418', B: '#f4f0e4' },
        draw: function (P, sp, dx, dy) {
            const S = new Sheet();
            /* the scroll, the neck, then the body pointing left from the
               chin: two bouts and the waist, f-holes, the bridge */
            S.rows(-5, 9, ['oo', 'oD', '.o']);
            S.rows(-3, 10, ['DDDD', 'FFFF']);
            S.rows(1, 8, [
                '.ooo..oooo.',
                'oWWWooWWWWo',
                'oWhWWWWWhWo',
                'FFFFFFbFFWo',
                'oWhWWWWWhwo',
                'owwwoowwwwo',
                '.ooo..oooo.',
            ]);
            /* the bow: a dark stick over its pale hair, from the right hand
               up across the strings by the bridge (drawn as the arm stands
               at 70deg; the arm saws it) */
            const B = new Sheet().line(10, 14, 4, 6, 'B').line(9, 14, 3, 6, 'b').put(3, 5, 'b');
            return { front: paint(S, P, dx, dy) + held('r', paint(B, P, dx, dy)) };
        },
    });

    /* ── trumpet: from the mouth out to the right and a little up,
       the right hand on the valves beside the face, the left steadying
       it from under the chin (sprite.over: drawn in front of the head,
       only the mouthpiece crosses the cheek) ─────────────────────── */
    register('trumpet', {
        genres: ['jazz', 'latin', 'punkska', 'soundtrack'],
        countries: ['mexico', 'cuba'],
        pairs: { puertorico: ['latin'] },
        pal: { o: '#4a3008', Y: '#f0c838', y: '#c09018', h: '#fff4b0', d: '#2a1a04' },
        draw: function (P, sp, dx, dy) {
            const S = new Sheet();
            /* the mouthpiece at her mouth (x 9-10, y 7), the lead pipe */
            S.put(11, 7, 'y');
            S.line(12, 7, 16, 6, 'Y');
            /* the valve block and its three buttons, the tuning slide below */
            S.rows(16, 3, ['h.h.h', 'YYYYY', 'YyYyY', 'oyyyo', '.YYY.', '.ooo.']);
            /* out to the bell */
            S.line(21, 4, 22, 4, 'Y');
            S.line(21, 5, 22, 5, 'y');
            S.rows(22, 0, [
                '....oo',
                '...oYo',
                '..YYdo',
                'YYYYdo',
                'yyyYdo',
                '..yYdo',
                '...yYo',
                '....oo',
            ]);
            return { front: paint(S, P, dx, dy), over: true };
        },
    });

    /* ── saxophone: down the front from the mouth, the bell curling up
       on the right; both hands on the keys ─────────────────────── */
    register('sax', {
        genres: ['jazz', 'funksoul', 'citypop'],
        pal: { o: '#4a3008', Y: '#e8b830', y: '#b88418', h: '#fff0a0', k: '#f4ecd8', d: '#2a1a04', b: '#1a1a1a' },
        draw: function (P, sp, dx, dy) {
            const S = new Sheet();
            /* the mouthpiece under the chin, the crook, the body down the
               front with its keys, the bow, the bell curling up on the right
               (over the arms: the hands hold it from behind) */
            S.rows(9, 9, [
                'bYYo.........',
                '..oYYo.......',
                '...oYo.......',
                '...oYko......',
                '...oYYo......',
                '...oYko..oooo',
                '...oYYo.oddddo',
                '...oYko.ohYYyo',
                '...oYYYo.oYyo.',
                '...oYkYo.oYyo.',
                '...oYYYYooYyo.',
                '....oYYYYYYyo.',
                '.....oyyyyyo..',
                '......ooooo...',
            ]);
            return { front: paint(S, P, dx, dy) };
        },
    });

    /* ── accordion: across the chest, the keys under the left hand, the
       bass buttons under the right, the bellows between (they pump) ── */
    register('accordion', {
        genres: ['folk'],
        countries: ['mexico', 'colombia', 'dominicanrepublic', 'france'],
        pairs: { argentina: ['folk', 'latin'] },
        pal: { o: O, R: '#c8283a', r: '#8a1826', k: '#f6f2ea', K: '#1a1a1e', b: '#f0c850', B: '#e8e8ee', m: '#c8c8d0',
               g: '#2a2a30', s: '#3a2a22' },
        draw: function (P, sp, dx, dy) {
            const S = new Sheet();
            /* the straps over the shoulders */
            S.line(6, 10, 6, 12, 's');
            S.line(13, 10, 13, 12, 's');
            S.rows(1, 12, [
                'ooooo..........ooooo',
                'okKkRoooooooooooRRRo',
                'okKkRrRrRrRrRrRRRRRo',
                'okkkRrRrRrRrRrRRbRbo',
                'okKkRrRrRrRrRrRRRRRo',
                'okkkRrRrRrRrRrRRbRbo',
                'okKkRrRrRrRrRrRRRRRo',
                'okkkRrRrRrRrRrRRbRbo',
                'okKkRrRrRrRrRrRRRRRo',
                'okkkRrRrRrRrRrRRmmmo',
                'ooooRoooooooooooRRRo',
                '...oooo........ooooo',
            ]);
            return { back: paint(S, P, dx, dy) };
        },
    });

    /* ── maracas: one in each hand, shaken high ────────────────── */
    register('maracas', {
        genres: ['latin'],
        countries: ['cuba', 'puertorico', 'venezuela', 'colombia'],
        pal: { o: '#2a140a', R: '#d83a2a', Y: '#f0c838', G: '#2a9a58', h: '#fff4c0', w: '#8a5a2a' },
        draw: function (P, sp, dx, dy) {
            /* the painted gourd up on its handle, out of the fist (drawn as
               the arms stand at ±130deg, raised) */
            const one = (x, a) => new Sheet().rows(x, -1, ['.o.', 'o' + a + 'o', a + 'h' + a, 'YYY', a + a + a, 'o' + a + 'o', '.w.', '.w.']);
            const L = one(-3, 'R'), R = one(21, 'G');
            return { front: held('l', paint(L, P, dx, dy)) + held('r', paint(R, P, dx, dy)) };
        },
    });

    /* ── keytar: a keyboard slung like a guitar, the grip and its
       buttons up to the left hand, the right hand on the keys ───── */
    register('keytar', {
        genres: ['electronic', 'citypop', 'pop'],
        pal: { o: O, W: '#f4f2ee', w: '#c8c8d0', k: '#fcfcff', K: '#1a1a1e', R: '#e8304a', r: '#a01c30', g: '#2a2a30',
               s: '#2a2a30', c: '#40d0e0' },
        draw: function (P, sp, dx, dy) {
            const S = new Sheet();
            strap(S, 7, 15);
            /* the grip with its buttons, then the body and two octaves */
            S.rows(-4, 14, ['ooo', 'oRco', '.oRRoo', '...oRRRo']);
            S.rows(3, 16, [
                'ooooooooooooooooo',
                'oRRRRRRRRRRRRRRRRo',
                'oRKkKkkKkKkkKkKkRo',
                'oRKkKkkKkKkkKkKkRo',
                'oRkkkkkkkkkkkkkkro',
                '.orrrrrrrrrrrrrro.',
                '..oooooooooooooo..',
            ]);
            return { back: paint(S, P, dx, dy) };
        },
    });

    /* ── microphone: a hand mic held up under the chin ─────────── */
    register('mic', {
        genres: ['pop', 'hiphop', 'funksoul', 'reggaeton'],
        pal: { o: O, g: '#4a4a54', G: '#2a2a32', h: '#a8a8b4', b: '#2a2a30', B: '#44444c', r: '#e8304a' },
        draw: function (P, sp, dx, dy) {
            /* up from the right hand to the chin: the grille, a red band, the
               handle (drawn as the arm stands at 70deg, across the chest) */
            const M = new Sheet().rows(8, 9, ['ogo', 'ghG', 'gGG', 'oGo', '.r.', '.b.']);
            return { front: held('r', paint(M, P, dx, dy)) };
        },
    });

    /* ── güira (Dominican Republic): a metal scraper held across the
       waist, raked with a wire brush in the right hand ──────────── */
    register('guira', {
        genres: [],
        countries: ['dominicanrepublic'],
        pal: { o: '#3a3e48', m: '#d4d8e0', M: '#9aa0ac', h: '#f6f8fc', d: '#5a5e6a', b: '#2a1a10', w: '#c8ccd4' },
        draw: function (P, sp, dx, dy) {
            const S = new Sheet();
            S.rows(-1, 16, [
                '..ooooooooooooo.',
                'bbomhmhmhmhmhmmo',
                'bbmdmdmdmdmdmdmo',
                'bbomMmMmMmMmMmMo',
                '..ooooooooooooo.',
            ]);
            /* the brush: a grip and its comb of wires on the cylinder (drawn
               as the right arm stands at 40deg; it rakes back and forth) */
            const B = new Sheet().rows(10, 14, ['..b', '..b', 'ooo', 'w.w', 'w.w']);
            return { back: paint(S, P, dx, dy), front: held('r', paint(B, P, dx, dy)) };
        },
    });

    /* ── drum kit: standing in front of the dancer — the kick drum,
       the snare and hi-hat on the left, a floor tom and a crash on the
       right — and a stick in each hand ─────────────────────────── */
    register('drums', {
        genres: ['rock', 'metal', 'punkska', 'funksoul', 'jazz', 'indie', 'pop', 'citypop'],
        pal: { o: O, w: '#f6f2ea', W: '#d8d2c4', R: '#c8283a', r: '#8a1826', c: '#f0c850', C: '#c09028',
               m: '#c8c8d0', M: '#8a8a96', s: '#f0d8a8', S: '#c8a878' },
        draw: function (P, sp, dx, dy) {
            const K = new Sheet();
            /* stands first, the drums over them */
            K.line(-6, 17, -6, 29, 'M').rows(-8, 30, ['MM.MM']);          /* hi-hat stand */
            K.line(-1, 24, -1, 29, 'M').rows(-3, 30, ['M...M']);          /* snare stand */
            K.line(25, 10, 25, 29, 'M').rows(23, 30, ['MM.MM']);          /* crash stand */
            /* the crash, tilted to us */
            K.rows(21, 6, ['..oooo.', '.occcCo', 'occcCCo', '.oooooo']);
            /* the hi-hat: two cymbals on the rod */
            K.rows(-9, 14, ['..o..', '.oco.', 'occCo', '.ooo.', 'occCo', '.ooo.']);
            /* the snare: head on top, red shell */
            K.rows(-4, 19, ['.ooooo.', 'owwwwwo', 'oRmRmRo', 'oRRRRro', '.ooooo.']);
            /* floor tom on legs */
            K.rows(16, 19, ['.oooooo.', 'owwwwwWo', 'omRRRRmo', 'oRRRRRro', 'oRRRRRro', 'omRRRRmo', '.oooooo.', '.M....M.', '.M....M.', '.M....M.', 'MM....MM']);
            /* the kick: its round front head with a red band, the rim */
            K.rows(3, 20, [
                '...oooooo...',
                '..oMMMMMMo..',
                '.oMwwwwwwMo.',
                'oMwwwwwwwwMo',
                'oMRRRRRRRRMo',
                'oMRRccccRRMo',
                'oMRRRRRRRRMo',
                'oMwwwwwwwwMo',
                '.oMwwwwwwMo.',
                '..oMMMMMMo..',
                '..oo....oo..',
            ]);
            /* a stick in each hand, drawn on the hit (the arms at ±20deg) */
            const L = new Sheet().line(3, 16, -1, 20, 's').put(-1, 20, 'S');
            const R = new Sheet().line(17, 16, 21, 20, 's').put(21, 20, 'S');
            return { stage: paint(K, P, dx, dy), front: held('l', paint(L, P, dx, dy)) + held('r', paint(R, P, dx, dy)) };
        },
    });

    function sprite(id, opts) {
        const d = DEFS[id];
        if (!d) return null;
        const dx = (opts && +opts.dx) || 0, dy = (opts && +opts.dy) || 0;
        const r = d.draw(d.pal || {}, spec, dx, dy) || {};
        return { back: r.back || '', front: r.front || '', stage: r.stage || '', over: !!r.over };
    }

    /* A song's instruments: those of its genre, plus its country's own
       (def.countries) unless the genre is one of MODERN, plus the
       def.pairs that name both its country and its genre */
    const MODERN = ['metal', 'electronic', 'ambient', 'hiphop'];
    function forSong(genre, country) {
        return IDS.filter(function (id) {
            const d = DEFS[id];
            if (genre && (d.genres || []).indexOf(genre) >= 0) return true;
            if (!country) return false;
            if ((d.countries || []).indexOf(country) >= 0 && MODERN.indexOf(genre) < 0) return true;
            const pair = d.pairs && d.pairs[country];
            return !!(pair && genre && pair.indexOf(genre) >= 0);
        });
    }

    window.MGInstruments = { ids: IDS, sprite: sprite, forSong: forSong, register: register, spec: spec, Sheet: Sheet };
})();
