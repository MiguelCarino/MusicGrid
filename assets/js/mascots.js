/* MusicGrid — the dancing mascots, original pixel art drawn run by run.
 *
 * The cast (MGMascots.names, in this order): "lola", an original adult
 * dancer in a white crop tee, black leggings and white sneakers (or, at
 * random, a bikini, a tube top and shorts, a sports bra and bike shorts, or
 * a mini dress, swapped now and then while she dances), whose hairstyle and
 * hair colour change at random every time she comes on (two skin looks: tan
 * with dark eyes, or fair with blue eyes and blonde, black or platinum
 * hair); "moe" (assets/js/mascot-moe.js) and "matrix" (mascot-matrix.js),
 * drawn the same way on this file's kit; and "crt", an original
 * beige-monitor buddy.
 *
 *   MGMascots.names                        every mascot id (a live array)
 *   MGMascots.register(name, def)          add a mascot (see "The registry")
 *   MGMascots.kit                          helpers for drawing one (see "The kit")
 *   MGMascots.figure(name, view, v, opts)  the SVG markup (viewBox MGMascots.viewBox(opts))
 *        view: 'front' | 'back' (facing away) | 'look' (facing away, looking
 *        back over the shoulder) | 'side' (bent over, from the side)
 *   MGMascots.variant(name, ctx)           a random look for that mascot (or null);
 *                                          ctx = { country, genre } of the song
 *   MGMascots.restyle(name, v, ctx)        the same look in other clothes
 *   MGMascots.faces(name) / express(name, v)  its expressions / v with another one
 *        figure opts: crew, partner, instrument (window.MGInstruments id)
 *   MGMascots.noTwerk / side / look        who never twerks / has a side / a look-back view
 *
 * Every figure is the same skeleton, so the CSS moves (grid.css, .mv-*) fit
 * them all: .fig > .leg-l .leg-r .upper > .hips .chest .arm-l .arm-r .head,
 * each <g> turned about its own joint. From behind the hips come in front.
 * In the browser each part is baked into one pixelated <image> so no
 * hairlines show between pixel rows when scaled or rotated.
 */
(function () {
    'use strict';

    /* crt's head: one letter per pixel, "." is transparent */
    const HEADS = {
        "crt": { pal: {"o": "#3a3528", "c": "#e3d9b8", "g": "#123c3a", "f": "#5dffc8", "l": "#4cd964"},
            rows: ["................",
                   ".oooooooooooooo.",
                   ".occcccccccccco.",
                   ".ocooooooooooco.",
                   ".ocoggggggggoco.",
                   ".ocogfggggfgoco.",
                   ".ocogfggggfgoco.",
                   ".ocoggggggggoco.",
                   ".ocofggggggfoco.",
                   ".ocogffffffgoco.",
                   ".ocoggggggggoco.",
                   ".ocooooooooooco.",
                   ".occccccccclcco.",
                   ".oooooooooooooo.",
                   "....occcccco....",
                   "..occcccccccco.."] },
    };

    /* crt's body. back: the head's main colour, which paints the back of
       the head when it turns around. */
    const BODIES = {
        crt:       { o: "#3a3528", torso: "#e3d9b8", trim: "#4cd964", arm: "#8a8576", leg: "#8a8576", back: "c" },
    };

    /* ── Pixel helpers ─────────────────────────────────────────── */
    /* rows of letters → one <rect> per run of the same colour; ox/oy is
       where the grid's top-left pixel lands; colour(ch) maps a letter */
    function pix(rows, ox, oy, colour) {
        let out = '';
        rows.forEach(function (row, y) {
            let x = 0;
            while (x < row.length) {
                const c = row[x] === '.' ? null : colour(row[x]);
                if (!c) { x++; continue; }
                let end = x + 1;
                while (end < row.length && row[end] !== '.' && colour(row[end]) === c) end++;
                out += '<rect x="' + (ox + x) + '" y="' + (oy + y) + '" width="' + (end - x) + '" height="1" fill="' + c + '"/>';
                x = end;
            }
        });
        return out;
    }
    /* An outlined block: the outline colour, the fill one pixel inside */
    function block(x, y, w, h, fill, o) {
        return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="' + o + '"/>' +
               '<rect x="' + (x + 1) + '" y="' + (y + 1) + '" width="' + (w - 2) + '" height="' + (h - 2) + '" fill="' + fill + '"/>';
    }
    function mirror(rows) { return rows.map(r => r.split('').reverse().join('')); }
    function shade(hex, k) {   /* darken (k < 1) or lighten (k > 1) a #rrggbb */
        const n = parseInt(hex.slice(1), 16);
        const f = c => Math.max(0, Math.min(255, Math.round(k < 1 ? c * k : c + (255 - c) * (k - 1))));
        return '#' + [n >> 16, (n >> 8) & 255, n & 255].map(f).map(c => c.toString(16).padStart(2, '0')).join('');
    }

    /* crt's head; from behind everything but the outline is its main colour */
    function headRects(name, back) {
        const h = HEADS[name], body = BODIES[name];
        return pix(h.rows, 2, 0, function (ch) {
            return h.pal[back && ch !== 'o' ? body.back : ch];
        });
    }

    /* crt: head 0-15, torso 15-22, hips 20-24, legs 23-29, arms either side
       of the torso. view 'look' = the body from behind, the screen to us. */
    function themeParts(name, view) {
        const b = BODIES[name], back = view !== 'front';
        const trim = back ? '' : '<rect x="9" y="16" width="2" height="5" fill="' + b.trim + '"/>';
        return {
            legL: block(5, 23, 4, 7, b.leg, b.o),
            legR: block(11, 23, 4, 7, b.leg, b.o),
            hips: block(5, 20, 10, 5, back ? b.leg : b.torso, b.o),
            chest: block(5, 15, 10, 7, b.torso, b.o) + trim,
            armL: block(2, 15, 4, 8, b.arm, b.o),
            armR: block(14, 15, 4, 8, b.arm, b.o),
            head: headRects(name, view === 'back'),
        };
    }

    /* ── lola: an original adult dancer, pixel by pixel ────────── */
    /* white crop tee, black high-waist leggings, white sneakers; a slimmer,
       longer body than the chibi mascots. Her hair is random every time. */
    const HAIR_STYLES = ['ponytail', 'ponytail', 'ponytail', 'long', 'bob', 'buns', 'pixie', 'curly', 'braids'];
    const HAIR_COLOURS = ['#2a1a12', '#4a2c1a', '#6b3e22', '#8a5a34', '#c8964a', '#a8401f', '#1b1410', '#e86aa6', '#5a3ad0'];

    /* two skin looks: 'tan' (the original, dark eyes, any hair colour above)
       and 'fair' (pale skin, blue eyes, blonde / black / platinum hair) */
    const FAIR_HAIR = ['#f0c850', '#e2b23c', '#1b1410', '#16161c', '#e2dccc', '#d2d2de'];
    const SKINS = {
        tan: { s: '#f0c09a', S: '#d89a74', e: '#6a3c22' },
        fair: { s: '#fde6d8', S: '#ecc2ac', o: '#3a2422', e: '#2f6fd8' },
    };

    /* Her outfits. The sprites mark each clothing region with its own
       letters, and an outfit decides whether a region is cloth or skin:
         u        the top above the bust (shoulders, upper back)
         w W x    the bust: always the top (x = the shade under the curves)
         v V      the sleeves on her arms
         m M      the midriff
         k K      the hips: always the bottoms
         t T      the thighs        j J   the shins
         n g      the shoes (upper, sole)
       top/bottom: colours to pick from ('same' = the top's colour). */
    const OUTFITS = {
        tee:    { w: 2, top: ['#fafafc'], upper: 1, sleeves: 1, mid: 0, bottom: ['#1c1c22'], thigh: 1, shin: 1, shoes: ['sneakers'] },
        bikini: { w: 1, top: ['#e0304a', '#20b0c0', '#ff5aa0', '#f0d030', '#fafafc', '#26262e', '#ff8a30'], upper: 0, sleeves: 0, mid: 0,
                  bottom: 'same', thigh: 0, shin: 0, shoes: ['sandals'] },
        tube:   { w: 1, top: ['#26262e', '#ff5aa0', '#fafafc', '#e0304a', '#9a4ae0'], upper: 0, sleeves: 0, mid: 0,
                  bottom: ['#3a5a98', '#26262e', '#e8e8f0'], thigh: 0, shin: 0, shoes: ['sneakers', 'heels'] },
        sports: { w: 1, top: ['#7ae04a', '#8a4ad8', '#ff5aa0', '#26262e', '#30c0e0'], upper: 0, sleeves: 0, mid: 0,
                  bottom: ['#1c1c22', '#3a3a52'], thigh: 1, shin: 0, shoes: ['sneakers'] },
        dress:  { w: 1, top: ['#c8203a', '#1c1c22', '#d8a830', '#c0c4d0', '#3048c0', '#e04a9a'], upper: 0, sleeves: 0, mid: 1,
                  bottom: 'same', thigh: 0, shin: 0, shoes: ['heels'] },

        /* National dress (only to a song from one of `countries`). Besides
           the fields above: sleeves 2 = long; blouse [..] = the shoulders
           and sleeves in their own colour; accent / print / flower / hat
           [..] colour lists (hat 'top' | 'accent' = that colour); leaf and
           trim fixed colours; dress = what Lola's sprites add (see
           dressFront / dressPose / dressSide):
             skirt    a SKIRTS shape, drawn on the hips (long ones hide the legs)
             hem      the row above the skirt's edge: 'ruffle' or a letter
             bands    accent bands, rows counted up from the skirt's edge
             tiers    a letter edging each step where the skirt widens
             centre   an accent trim down the front
             collar   'cross' (wrap), 'lei', 'bow', 'off' (off-shoulder ruffle)
             chest / sleeve  'stitch' (embroidery); sleeve 'buttons' | 'puff'
             yoke, shawl, sash (accent waistband), bow (a bow at the back),
             midSkirt (the skirt starts under the bust), goreum (a ribbon)
             print    a PRINTS pattern on printOn ['top', 'skirt']
             head     a HATS piece  */
        yukata:     { w: 1, countries: ['japan'], top: ['#2a3a78', '#f4f0e6', '#e86a9a', '#3a7a6a', '#b8203a'], bottom: 'same',
                      upper: 1, sleeves: 2, mid: 1, thigh: 0, shin: 0, shoes: ['geta'],
                      accent: ['#f0c030', '#e0304a', '#ff8ab0', '#f4f0e6', '#8a4ad8'], print: ['#fafafc', '#ffb0c8', '#f0d030', '#2a3a78'],
                      flower: ['#ff6a9a', '#f0d030', '#fafafc'], trim: '#fafafc',
                      dress: { collar: 'cross', sash: true, bow: true, skirt: 'straight', print: 'blossom', printOn: ['top', 'skirt'], head: 'kanzashi' } },
        hanbok:     { w: 1, countries: ['korea'], top: ['#f6d23a', '#ffb6c8', '#f4f0e6', '#7ad0a0', '#9ad0f0'],
                      bottom: ['#e0304a', '#d03a8a', '#2a3a98', '#6a3ab0'], upper: 1, sleeves: 2, mid: 1, thigh: 0, shin: 0, shoes: ['flats'],
                      accent: ['#e0304a', '#8a4ad8', '#2a3a98', '#d03a8a'], trim: '#fafafc',
                      dress: { collar: 'cross', midSkirt: true, goreum: true, skirt: 'bell' } },
        folklorico: { w: 1, countries: ['mexico'], top: ['#fafafc'], bottom: ['#e0304a', '#ff5aa0', '#2a9a4a', '#f0b020', '#3a6ad8', '#8a4ad8'],
                      upper: 1, sleeves: 1, mid: 1, thigh: 0, shin: 0, shoes: ['heels'],
                      accent: ['#f0d030', '#fafafc', '#2a9a4a', '#e0304a', '#3a6ad8'], flower: ['#e0304a', '#ff5aa0', '#f0d030'],
                      dress: { yoke: true, sleeve: 'puff', skirt: 'full', bands: [2, 4], hem: 'ruffle', head: 'flower' } },
        charra:     { w: 1, countries: ['mexico'], top: ['#1c1c22', '#6a1224', '#f4f0e6'], bottom: 'same',
                      upper: 1, sleeves: 2, mid: 1, thigh: 0, shin: 0, shoes: ['boots'],
                      accent: ['#e0304a', '#2a9a4a', '#f0d030'], hat: ['#1c1c22', '#d8c08a'], gold: '#dfe3ea',
                      dress: { collar: 'bow', sleeve: 'buttons', skirt: 'aline', hem: 'Y', head: 'sombrero' } },
        sarafan:    { w: 1, countries: ['russia'], top: ['#c8203a', '#2a3a98', '#2a7a4a'], bottom: 'same', blouse: ['#fafafc'],
                      upper: 1, sleeves: 2, mid: 1, thigh: 0, shin: 0, shoes: ['flats'],
                      accent: ['#e8c050'], hat: 'top', trim: '#fafafc',
                      dress: { centre: true, skirt: 'aline', hem: 'f', bands: [3], head: 'kokoshnik' } },
        vyshyvanka: { w: 1, countries: ['ukraine'], top: ['#fafafc'], bottom: ['#c8203a', '#1c1c22', '#2a3a78'],
                      upper: 1, sleeves: 2, mid: 1, thigh: 0, shin: 0, shoes: ['redboots'],
                      accent: ['#c8203a', '#1c1c22'], print: ['#1c1c22', '#c8203a'], flower: ['#e0304a', '#f0d030', '#3a6ad8'],
                      dress: { chest: 'stitch', sleeve: 'stitch', sash: true, skirt: 'aline', hem: 'f', head: 'vinok' } },
        aloha:      { w: 1, countries: ['usa'], top: ['#e0304a', '#2a9ad0', '#f0a020', '#2a9a6a', '#ff7a5a'],
                      bottom: ['#f4f0e6', '#3a5a98', '#e8d8b0'], upper: 1, sleeves: 1, mid: 0, thigh: 0, shin: 0, shoes: ['sandals'],
                      print: ['#fafafc', '#ffd0e0', '#f0d030'], leaf: '#2a7a3a', flower: ['#ff5a8a', '#f0d030', '#fafafc', '#ff8a30'],
                      trim: '#fafafc',
                      dress: { collar: 'lei', print: 'flower', printOn: ['top'], head: 'flower' } },
        flamenca:   { w: 1, countries: ['spain'], top: ['#e0304a', '#1c1c22', '#fafafc', '#2a9a6a', '#f0b020', '#3a6ad8'], bottom: 'same',
                      upper: 1, sleeves: 1, mid: 1, thigh: 0, shin: 0, shoes: ['heels'],
                      print: ['#fafafc', '#1c1c22'], flower: ['#e0304a', '#fafafc', '#f0b020'],
                      dress: { skirt: 'flamenca', tiers: 'p', hem: 'ruffle', sleeve: 'puff', print: 'dots', printOn: ['top', 'skirt'], head: 'flower' } },
        pollera:    { w: 1, countries: ['colombia', 'panama'], top: ['#fafafc'], bottom: ['#fafafc', '#e0304a', '#f0c020', '#2a6ad8'],
                      upper: 0, sleeves: 0, mid: 1, thigh: 0, shin: 0, shoes: ['flats'],
                      accent: ['#e0304a', '#f0c020', '#2a6ad8', '#2a9a4a'], flower: ['#e0304a', '#f0c020', '#ff5aa0'],
                      dress: { collar: 'off', skirt: 'full', bands: [2, 4, 6], hem: 'f', head: 'flower' } },
        carnaval:   { w: 1, countries: ['brazil'], top: ['#f0c020', '#2ab06a', '#e0304a', '#ff5aa0', '#3a6ad8'], bottom: 'same',
                      upper: 0, sleeves: 0, mid: 0, thigh: 0, shin: 0, shoes: ['heels'],
                      print: ['#fafafc', '#f0e080'], accent: ['#2ab06a', '#f0c020', '#3a6ad8', '#e0304a', '#ff5aa0'],
                      flower: ['#ff5aa0', '#f0c020', '#2ab06a'],
                      dress: { skirt: 'knee', hem: 'f', print: 'sparkle', printOn: ['top', 'skirt'], head: 'feathers' } },
        bata:       { w: 1, countries: ['puertorico', 'cuba', 'dominicanrepublic'], top: ['#fafafc', '#e0304a', '#f0c020', '#3a6ad8'],
                      bottom: 'same', upper: 0, sleeves: 0, mid: 1, thigh: 0, shin: 0, shoes: ['flats'],
                      accent: ['#e0304a', '#f0c020', '#3a6ad8', '#2a9a4a', '#fafafc'], hat: 'accent', trim: '#fafafc',
                      dress: { collar: 'off', skirt: 'full', bands: [3], hem: 'q', head: 'turban' } },
        tartan:     { w: 1, countries: ['uk'], top: ['#fafafc', '#1c1c22', '#2a3a5a'], bottom: ['#b8202a', '#2a5a3a', '#2a3a78'],
                      upper: 1, sleeves: 2, mid: 1, thigh: 0, shin: 0, shoes: ['boots'],
                      accent: ['#1c1c22', '#f0d030', '#fafafc'],
                      dress: { skirt: 'pleat', print: 'check', printOn: ['skirt'] } },
        cholita:    { w: 1, countries: ['bolivia'], top: ['#e0304a', '#2a9a6a', '#8a4ad8', '#f0a020'],
                      bottom: ['#ff5aa0', '#3a6ad8', '#e06a20', '#2a9a6a'], upper: 1, sleeves: 2, mid: 1, thigh: 0, shin: 0, shoes: ['flats'],
                      accent: ['#a87a4a', '#6a3a8a', '#c8203a', '#2a6a5a'], hat: ['#3a2a22', '#1c1c22'],
                      dress: { shawl: true, skirt: 'cholita', bands: [2], hem: 'ruffle', head: 'bowler' } },
        ie:         { w: 1, countries: ['romania'], top: ['#fafafc'], bottom: ['#1c1c22', '#6a1224'],
                      upper: 1, sleeves: 2, mid: 1, thigh: 0, shin: 0, shoes: ['flats'],
                      accent: ['#c8203a', '#1c1c22'], print: ['#2a3a78', '#e8c050'],
                      dress: { chest: 'stitch', sleeve: 'stitch', sash: true, skirt: 'straight', bands: [2], hem: 'f' } },
    };
    const SHOES = {
        sneakers: { n: '#ffffff', g: '#b0b0bc' },
        heels:    { n: '#1c1c22', g: '#3a3a46' },
        sandals:  null,   /* bare feet, a strap in the top's colour */
        geta:     { n: '#fafafc', g: '#b07a48' },   /* white tabi on wooden geta */
        flats:    { n: '#c8203a', g: '#6a1020' },
        boots:    { n: '#2a1a14', g: '#140c08' },
        redboots: { n: '#b8202a', g: '#5a1014' },
    };
    /* national-dress skirts: half-widths per row from y 17 (the hips' top,
       front and posed views alike), centred on x 9.5; the last row is
       the edge (outline) */
    const SKIRTS = {
        straight: [5, 5, 5, 5, 5, 6, 6, 6, 6, 6, 6],
        aline:    [5, 5, 5, 6, 6, 6, 7, 7, 7, 7, 7],
        full:     [5, 6, 6, 7, 7, 8, 8, 8, 9, 9, 9],
        bell:     [6, 7, 7, 8, 8, 8, 9, 9, 9, 9, 9],
        flamenca: [5, 5, 5, 5, 5, 6, 7, 7, 8, 9, 9],
        knee:     [5, 6, 6, 6, 7, 7],
        pleat:    [5, 5, 6, 6, 6, 6, 6],
        cholita:  [6, 7, 8, 8, 9, 9, 9, 9, 9],
    };
    /* prints: (x, y) → a letter painted over the cloth, or null */
    const PRINTS = {
        dots:    (x, y) => (y % 2 === 0 && (x + y) % 4 === 0 ? 'p' : null),
        flower:  (x, y) => { const k = (x + 3 * y + 70) % 7; return k === 0 && y % 2 ? 'p' : k === 1 && y % 2 ? 'd' : null; },
        check:   (x, y) => (y % 3 === 0 ? (x % 3 === 0 ? 'F' : 'f') : x % 3 === 0 ? 'f' : null),
        sparkle: (x, y) => ((7 * x + 13 * y + 110) % 11 === 0 || (5 * x + 3 * y + 100) % 13 === 0 ? 'p' : null),
        blossom: (x, y) => (y % 3 === 1 && (x + y + 60) % 6 < 2 ? 'p' : null),
    };
    /* headpieces, as runs in the front view's coordinates (the pose and
       side heads shift them) */
    const HATS = {
        kanzashi:  [[-1, 13, 'c'], [0, 12, 'cqc'], [1, 13, 'c'], [1, 15, 'Y'], [2, 15, 'Y']],
        flower:    [[-2, 13, 'cc'], [-1, 12, 'cYcc'], [0, 12, 'cccd'], [1, 13, 'cd']],
        vinok:     [[-3, 5, 'c..q..c..q'], [-2, 4, 'cqcdcqcqdcqc']],
        kokoshnik: [[-7, 6, 'oooooooo'], [-6, 5, 'ozzzzzzzzo'], [-5, 4, 'ozYzzzzzzYzo'], [-4, 4, 'ozzzYzzYzzzo'],
                    [-3, 4, 'ozYzzzzzzYzo'], [-2, 4, 'ozzzzzzzzzzo'], [-1, 4, 'oqYqYqqYqYqo']],
        sombrero:  [[-7, 7, 'oooooo'], [-6, 6, 'ozzzzzzo'], [-5, 6, 'ozZzzZzo'], [-4, 6, 'ozzzzzzo'], [-3, 6, 'oYYYYYYo'],
                    [-3, -2, 'oz'], [-3, 20, 'zo'],
                    [-2, -1, 'ozYzzYzzzzzzzzzzYzzYzo'], [-1, -2, 'ooZZZZZZZZZZZZZZZZZZZZoo']],
        turban:    [[-5, 7, 'oo'], [-5, 11, 'oo'], [-4, 6, 'offFFffo'], [-3, 4, 'offFffffFffo'],
                    [-2, 3, 'ofFffFffFffFfo'], [-1, 3, 'offFffffffFffo'], [0, 4, 'oFFFFFFFFFFo']],
        feathers:  [[-7, 5, 'fpcfppfcpf'], [-6, 4, 'fpcfpccpfcpf'], [-5, 4, 'fpcfpccpfcpf'], [-4, 5, 'pcfpccpfcp'],
                    [-3, 6, 'cfpccpfc'], [-2, 5, 'oYqYqqYqYo']],
        bowler:    [[-6, 7, 'oooooo'], [-5, 6, 'ozzzzzzo'], [-4, 6, 'ozzzzzzo'], [-3, 6, 'ofFffFfo'], [-2, 5, 'oZZZZZZZZo']],
    };
    function hatRuns(kind, dx, dy) {
        return (HATS[kind] || []).map(r => [r[0] + dy, r[1] + dx, r[2]]);
    }
    /* paint each letter of some runs through fn(ch, x, y) (null = keep) */
    function paintRuns(runs, fn) {
        return runs.map(r => [r[0], r[1], r[2].split('').map((ch, i) => (ch === '.' ? ch : fn(ch, r[1] + i, r[0]) || ch)).join('')]);
    }
    const toRuns = (rows, ox, oy) => rows.map((r, i) => [oy + i, ox, r]);
    /* the outfit entry a lola variant wears, and its national dress */
    function outfitEntry(v) { return (v && v.outfit && OUTFITS[v.outfit.name]) || OUTFITS.tee; }
    function dressOf(v) { return outfitEntry(v).dress || null; }
    /* the print as a painter for a part: which letters it may cover */
    function printer(v, where) {
        const o = outfitEntry(v), d = o.dress;
        if (!d || !d.print || (d.printOn || ['top']).indexOf(where) < 0) return null;
        const on = where === 'skirt' ? 'k' : 'w' + (o.upper ? 'u' : '') + (o.mid && !d.midSkirt ? 'm' : '') + (o.sleeves ? 'v' : '');
        const f = PRINTS[d.print];
        return (ch, x, y) => (on.indexOf(ch) >= 0 ? f(x, y) : null);
    }
    /* the skirt as runs from y0 (front / pose): outline, cloth with folds,
       tiers, accent bands, a hem row, the edge */
    function skirtRuns(d, y0, back) {
        const hw = SKIRTS[d.skirt], n = hw.length, runs = [];
        hw.forEach(function (h, i) {
            const x0 = 10 - h, w = 2 * h, up = n - 1 - i;
            const folds = i > 1 ? [-2, -1, 1, 2].map(k => Math.floor(9.5 + k * h / 3 + 0.5)) : [];
            let s = '';
            for (let c = 0; c < w; c++) {
                const x = x0 + c;
                let ch;
                if (up === 0 || c === 0 || c === w - 1) ch = 'o';
                else if (i === 0) ch = c === 1 || c === w - 2 ? 'K' : 'k';
                else if (up === 1 && d.hem) ch = d.hem === 'ruffle' ? (x % 2 ? 'K' : 'k') : d.hem;
                else if (d.bands && d.bands.indexOf(up) >= 0) ch = 'f';
                else if (d.tiers && h > hw[i - 1]) ch = d.tiers;
                else if (d.centre && !back && (x === 9 || x === 10)) ch = 'f';
                else ch = folds.indexOf(x) >= 0 ? 'K' : 'k';
                s += ch;
            }
            runs.push([y0 + i, x0, s]);
        });
        return runs;
    }
    /* a national outfit's random colours on top of pickOutfit's */
    function dressUp(of) {
        const o = OUTFITS[of.name];
        if (!o || !o.dress) return of;
        const pick = arr => arr[Math.floor(Math.random() * arr.length)];
        const besides = (list, not) => { const l = (list || []).filter(c => not.indexOf(c) < 0); return l.length ? pick(l) : (list || [])[0]; };
        const r = Object.assign({}, of);
        r.accent = besides(o.accent, [of.top, of.bottom]);
        r.print = besides(o.print, [of.top, of.bottom, r.accent]);
        r.flower = besides(o.flower, [r.accent]);
        if (o.blouse) r.blouse = pick(o.blouse);
        r.hat = o.hat === 'top' ? of.top : o.hat === 'accent' ? r.accent : o.hat ? pick(o.hat) : null;
        return r;
    }
    /* National outfits: an entry with countries: ['japan', ...] is worn
       only to a song from one of those countries, and then about 45% of the
       time (NATIONAL_ODDS); otherwise, and with no country, only the
       everyday entries (no `countries`) are rolled. */
    const NATIONAL_ODDS = 0.45;
    /* the name of a random outfit (not `not`) from a table shaped like
       OUTFITS, for a song from `country` (optional) */
    function pickOutfitName(not, table, country) {
        table = table || OUTFITS;
        const pick = arr => arr[Math.floor(Math.random() * arr.length)];
        const keys = Object.keys(table);
        const isNat = k => Array.isArray(table[k].countries);
        const fits = k => isNat(k) && !!country && table[k].countries.indexOf(country) >= 0;
        const bagOf = list => {
            const bag = [];
            list.forEach(k => { if (k !== not) for (let i = 0; i < (table[k].w || 1); i++) bag.push(k); });
            return bag;
        };
        const national = bagOf(keys.filter(fits));
        if (national.length && Math.random() < NATIONAL_ODDS) return pick(national);
        let bag = bagOf(keys.filter(k => !isNat(k)));
        if (!bag.length) bag = national.length ? national : keys.filter(k => !isNat(k) || fits(k));
        if (!bag.length) bag = keys.filter(k => !isNat(k));
        return pick(bag.length ? bag : keys);
    }
    /* a random outfit { name, top, bottom, shoes } (not the one named
       `not`) from a table shaped like OUTFITS (default OUTFITS), for a song
       from `country` (optional; see NATIONAL_ODDS) */
    function pickOutfit(not, table, country) {
        table = table || OUTFITS;
        const pick = arr => arr[Math.floor(Math.random() * arr.length)];
        const name = pickOutfitName(not, table, country), o = table[name], top = pick(o.top);
        return { name: name, top: top, bottom: o.bottom === 'same' ? top : pick(o.bottom), shoes: pick(o.shoes) };
    }
    const ctxCountry = ctx => (ctx && ctx.country) || null;
    function lolaVariant(ctx) {
        const pick = arr => arr[Math.floor(Math.random() * arr.length)];
        const skin = Math.random() < 0.5 ? 'fair' : 'tan';
        return { skin: skin, hair: pick(HAIR_STYLES), colour: pick(skin === 'fair' ? FAIR_HAIR : HAIR_COLOURS),
                 eyes: SKINS[skin].e, outfit: dressUp(pickOutfit(null, OUTFITS, ctxCountry(ctx))), face: 'smile' };
    }
    /* the same lola in a different outfit */
    function restyle(v, ctx) {
        v = v || lolaVariant(ctx);
        return Object.assign({}, v, { outfit: dressUp(pickOutfit(v.outfit && v.outfit.name, OUTFITS, ctxCountry(ctx))) });
    }
    /* a cloth colour's shades: darker for light cloth, lighter for dark */
    function clothShades(c) {
        const n = parseInt(c.slice(1), 16);
        const lum = 0.3 * (n >> 16) + 0.59 * ((n >> 8) & 255) + 0.11 * (n & 255);
        return lum < 70 ? [shade(c, 1.12), shade(c, 1.22)] : [shade(c, 0.85), shade(c, 0.72)];
    }
    /* her palette for a variant; old variants ({ hair, colour }) are tan,
       in the white tee and black leggings. Other characters reuse it:
         base    their own base letters (default LOLA), merged first
         table   their own outfit table shaped like OUTFITS (default OUTFITS)
         v.skinPal  a skin palette { s, S, o?, e? } instead of SKINS[v.skin]
       The tee keeps its fixed grey shades only when the top is white. */
    function lolaPalette(v, base, table) {
        table = table || OUTFITS;
        const sk = v.skinPal || SKINS[v.skin] || SKINS.tan;
        const P = Object.assign({}, LOLA, { r: shade(v.colour, 0.55) }, base || {}, sk, { h: v.colour, H: shade(v.colour, 0.7) });
        if (v.eyes) P.e = v.eyes;
        const of = v.outfit || { name: 'tee', top: '#fafafc', bottom: '#1c1c22', shoes: 'sneakers' };
        const o = table[of.name] || table.tee || OUTFITS.tee;
        const plain = of.name === 'tee' && of.top === '#fafafc';
        const T = plain ? ['#d6d6de', '#b0b0bc'] : clothShades(of.top);
        const B = of.name === 'tee' && of.bottom === '#1c1c22' ? ['#3a3a46'] : [clothShades(of.bottom)[1]];
        P.w = of.top; P.W = T[0]; P.x = T[1];
        P.k = of.bottom; P.K = B[0];
        /* the crease: a touch darker than light cloth, a touch lighter
           than dark cloth (black on black would vanish) */
        P.D = clothShades(of.bottom)[0];
        P.L = shade(of.bottom, 1.18);   /* the shine on the cheeks: always lighter */
        const cloth = (on, a, b, sa, sb) => { P[a] = on ? sa : P.s; P[b] = on ? sb : P.S; };
        cloth(o.upper, 'u', 'U', P.w, P.W);
        cloth(o.sleeves, 'v', 'V', P.w, P.W);
        cloth(o.mid, 'm', 'M', P.w, P.W);
        cloth(o.thigh, 't', 'T', P.k, P.K);
        cloth(o.shin, 'j', 'J', P.k, P.K);
        if (!o.thigh) P.T = P.s;   /* bare legs: no seam line */
        if (!o.shin) P.J = P.s;
        const sh = SHOES[of.shoes];
        if (sh) { P.n = sh.n; P.g = sh.g; } else { P.n = P.s; P.g = P.w; }
        if (o.dress) {
            /* national dress letters: f F accent, p print, d leaf, q trim
               (collar, lace, pearls), c flower, z Z headpiece, Y gold */
            const first = l => (Array.isArray(l) ? l[0] : null);
            P.f = of.accent || first(o.accent) || '#e8c050'; P.F = clothShades(P.f)[0];
            P.p = of.print || first(o.print) || '#fafafc';
            P.d = o.leaf || '#2a8a4a';
            P.q = o.trim && o.trim !== of.top ? o.trim : o.trim ? shade(of.top, 0.8) : '#fafafc';
            P.c = of.flower || first(o.flower) || '#e0304a';
            P.z = of.hat || (o.hat === 'top' ? of.top : first(o.hat)) || P.f; P.Z = clothShades(P.z)[0];
            P.Y = o.gold || '#e8c050';
            const bl = of.blouse || first(o.blouse);
            if (bl) {
                const S = clothShades(bl);
                if (o.upper) { P.u = bl; P.U = S[0]; }
                if (o.sleeves) { P.v = bl; P.V = S[0]; }
            }
            if (o.dress.midSkirt) { P.m = P.k; P.M = P.K; }
        }
        return P;
    }

    const LOLA = {
        o: '#2a1a14', s: '#f0c09a', S: '#d89a74', w: '#fafafc', W: '#d6d6de',
        k: '#1c1c22', K: '#3a3a46', n: '#ffffff', g: '#b0b0bc', e: '#2a1a14', l: '#d0607a', y: '#e8c050',
        a: '#1a1012', i: '#ffffff', b: '#f0909a', q: '#8fd0f4',
    };
    /* the face, 10 wide, at x 5–14, y 1–9: brows (r), then
       two round 2x2 eyes (iris e, a highlight i), nose, lips; no lashes */
    const LOLA_FACE = [
        "..oooooo..",
        ".osssssso.",
        "osrrssrrso",
        "oseesseeso",
        "osiessieso",
        "ossssSssso",
        ".ossllsso.",
        "..osssso..",
        "...oooo...",
    ];
    /* Her expressions (all positive): rows of LOLA_FACE swapped by v.face.
       a = the open mouth, i = teeth / highlight, b = blush. Closed happy
       eyes are a dark bar with soft (skin-shade) corners under it, a
       gentle arc that never touches the face's outline; the brows go so
       the arcs read clean. The wink closes the right eye to a low bar.
       No lashes. */
    const FACES = ['smile', 'grin', 'joy', 'wink', 'sing', 'laugh', 'blush'];
    const FACE_ROWS = {
        smile: {},
        grin:  { 6: ".osliilso.", 7: "..osllso.." },
        joy:   { 2: "osssssssso", 3: "osoossooso", 4: "osSssssSso", 6: ".osllllso." },
        wink:  { 3: "oseessssso", 4: "osiessooso", 6: ".osllllso." },
        sing:  { 6: ".oslaalso.", 7: "..osllso.." },
        laugh: { 2: "osssssssso", 3: "osoossooso", 4: "osSssssSso", 6: ".oliiiilo.", 7: "..olaalo.." },
        blush: { 5: "obsssSssbo", 6: ".osllllso." },
        sad:         { 2: "ossrssrsso", 3: "osaassaaso", 4: "oseesseeso", 6: ".osSllSso.", 7: "..olsslo.." },
        heartbroken: { 2: "ossrssrsso", 3: "osssssssso", 4: "osaassaaso", 5: "osqssSsqso", 6: ".osSllSso.", 7: "..olsslo.." },
        pensive:     { 3: "osaassaaso", 4: "ossessseso", 6: ".osssllso." },
        skyward:     { 3: "osiessieso", 4: "osSSssSSso", 5: "ossssSsqso", 6: ".ossaasso." },
    };
    /* Sad faces for melancholic songs (dancer.js picks them by the song's
       mood, never mixed with the happy ones): sad (lids low, a frown),
       heartbroken (eyes shut, a tear on each cheek), pensive (lids low,
       looking aside, a small flat mouth), skyward (looking up, a raindrop
       on the cheek: the rain move). q = a tear / raindrop. */
    const SAD_FACES = ['sad', 'heartbroken', 'pensive'];
    function faceRows(face) {
        const swap = FACE_ROWS[face] || FACE_ROWS.smile;
        return LOLA_FACE.map((r, i) => swap[i] || r);
    }
    /* hair layers: 16 wide at x 2–17, from y -2 (row 0) */
    const CAP = [
        "................",
        ".....hhhhhh.....",
        "...hhhhhhhhhh...",
        "..hhhhhhhhhhhh..",
        "..hhhHhhhhHhhh..",
        "..hh........hh..",
        "..h..........h..",
    ];
    function rowsAt(list, n) {   /* pad a sparse {row: string} map into rows */
        const out = [];
        for (let i = 0; i < n; i++) out.push(list[i] || '................');
        return out;
    }
    function lolaHairLayers(style) {
        /* F: over the face; B: behind the body (front view); K: from behind */
        const F = {}, B = {}, K = {};
        CAP.forEach((r, i) => { F[i] = r; });
        switch (style) {
            case 'ponytail':
                /* the tail belongs to the head (it moves with it), ending at
                   the chin so the head still turns about its neck */
                F[2] = "...hhhhhhhhhhH..";
                for (let i = 3; i <= 11; i++) F[i] = (F[i] || "................").slice(0, 14) + (i < 11 ? "hH" : "h.");
                for (let i = 3; i <= 11; i++) K[i] = i < 11 ? ".......hH......." : ".......h........";
                K[2] = "......HHH.......";
                break;
            case 'long':
                for (let i = 7; i <= 15; i++) F[i] = "..hH........Hh..";
                for (let i = 7; i <= 15; i++) K[i] = "...hhhhhhhhhh...";
                K[16] = "....hHhhhhHh....";
                break;
            case 'bob':
                F[7] = "..hH........Hh.."; F[8] = "..hH........Hh.."; F[9] = "..hh........hh..";
                K[7] = "...hhhhhhhhhh..."; K[8] = "...hhhhhhhhhh..."; K[9] = "...hHhhhhhhHh...";
                break;
            case 'buns':
                F[0] = "...hhh....hhh..."; F[1] = "...hHhhhhhhHh...";
                K[0] = F[0]; K[1] = F[1];
                break;
            case 'pixie':
                F[5] = "..hhhhh.....hh.."; F[6] = "..hhh.........h.";
                break;
            case 'curly':
                F[1] = "....hhhhhhhh....";
                F[2] = "..HhhhhhhhhhhH..";
                F[3] = ".hhhhhhhhhhhhhh.";
                F[4] = ".hHhhHhhhhHhhHh.";
                for (let i = 5; i <= 11; i++) F[i] = i % 2 ? ".hh..........hh." : ".Hh..........hH.";
                for (let i = 5; i <= 11; i++) K[i] = i % 2 ? ".hhhhhhhhhhhhhh." : ".hHhhHhhhhHhhHh.";
                K[1] = F[1]; K[2] = F[2]; K[3] = F[3]; K[4] = F[4];
                break;
            case 'braids':
                for (let i = 7; i <= 17; i++) F[i] = i % 2 ? "..h..........h.." : "..H..........H..";
                F[18] = "..y..........y..";
                for (let i = 6; i <= 17; i++) K[i] = i % 2 ? "......h..h......" : "......H..H......";
                K[18] = "......y..y......";
                break;
        }
        return { F: rowsAt(F, 20), B: rowsAt(B, 20), K: rowsAt(K, 20) };
    }

    function lolaParts(view, v) {
        v = v || lolaVariant();
        const back = view !== 'front';
        const P = lolaPalette(v);
        const col = ch => P[ch];
        const hair = lolaHairLayers(v.hair);
        const o = outfitEntry(v), d = dressOf(v);

        const legRows = [
            ".ottTo", ".ottTo", ".ottTo", ".ottTo",
            "..ojjo", "..ojjo", "..ojjo", "..ojjo",
            "onnnno", "oggggo",
        ];
        const chestRows = back ? [
            "...osso...",
            "owwwwwwwwo",
            "owwwwwwwwo",
            "owwwwwwwWo",
            "owwwwwwwWo",
            ".oWWWWWWo.",
            ".osssSsso.",
            ".osssSsso.",
        ] : [
            /* from the front, 12 wide (x 4–15): a fuller bust under the tee,
               a soft shade under the bust and between, the hem hanging loose over the waist */
            "....osso....",
            ".ouuuuuuuuo.",
            "owwwwwwwwwwo",
            "owwwwwwwwwwo",
            "owwwwWWwwwwo",
            ".oWWWWWWWWo.",
            "..oMMMMMMo..",
            "..ommmmMmo..",
        ];
        const hipRows = back
            ? ["oKkkkkkkKo", "okkkkKkkko", "okkkKKkkko", "okkkkKkkko"]
            : ["oKkkkkkkKo", "okkkkkkkko", "okkkkkkkko", "okkkkkkkko"];
        let armRows = [".ovv", "ovVv", "osso", "osso", "osso", "osso", "osso", "osSo", "osso", ".oo."];
        if (d) {
            if (!back) dressFront(chestRows, d);
            else if (d.sash) { chestRows[6] = ".offfffFo."; }
            armRows = dressArm(armRows, o, d);
        }

        let head;
        if (view === 'back') {
            /* the back of her head: the face's shape all in hair, then the style */
            const backFace = LOLA_FACE.map(r => r.replace(/[^.o]/g, 'h'));
            head = pix(backFace, 5, 1, col) + pix(CAP, 2, -2, col) + pix(hair.K, 2, -2, col);
        } else {
            head = pix(faceRows(v.face), 5, 1, col) + '<rect x="4" y="5" width="1" height="1" fill="' + P.y + '"/><rect x="15" y="5" width="1" height="1" fill="' + P.y + '"/>' +
                   pix(hair.F, 2, -2, col);
        }
        if (d && d.head) head += spec(hatRuns(d.head, 0, 0), col);
        /* the print, then the parts (spec draws runs, pix draws rows) */
        const top = printer(v, 'top') || (() => null), sk = printer(v, 'skirt');
        const paint = (rows, ox, oy) => spec(paintRuns(toRuns(rows, ox, oy), top), col);
        const hips = d && d.skirt ? spec(sk ? paintRuns(skirtRuns(d, 17), sk) : skirtRuns(d, 17), col) : pix(hipRows, 5, 17, col);
        return {
            legL: pix(legRows, 4, 20, col),
            legR: pix(mirror(legRows), 10, 20, col),
            hips: hips,
            /* from the front the bust rows (y 11–14) are their own .bust
               group, which jiggles a little on the beat (grid.css) */
            chest: back ? paint(chestRows, 5, 9)
                 : pix(hair.B, 2, -2, col) + paint(chestRows.slice(0, 2), 4, 9) +
                   bustGroup(spec(paintRuns(toRuns(chestRows.slice(2, 6), 4, 11), top), col)) + paint(chestRows.slice(6), 4, 15),
            armL: paint(armRows, 2, 10),
            armR: paint(mirror(armRows), 14, 10),
            head: head,
        };
    }
    /* national dress on the front chest rows (12 wide, x 4–15, y 9–16) */
    function dressFront(c, d) {
        const put = (i, at, str) => { c[i] = c[i].slice(0, at) + str + c[i].slice(at + str.length); };
        if (d.collar === 'cross') {   /* a wrapped collar, left over right */
            c[1] = ".ouuqssquuo."; put(2, 5, 'qq'); put(3, 6, 'q'); put(4, 6, 'q'); put(5, 6, 'q');
        }
        if (d.collar === 'lei') { put(1, 2, 'cqc'); put(1, 7, 'cqc'); put(2, 2, 'q'); put(2, 9, 'q'); put(3, 3, 'cqcqcq'); }
        if (d.collar === 'bow') { c[1] = ".ouffFFffuo."; put(2, 4, 'f'); put(2, 7, 'f'); }
        if (d.collar === 'off') c[2] = "oWwWwWwWwWwo";
        if (d.yoke) put(1, 3, 'fcfcfc');
        if (d.shawl) { c[1] = ".offffffffo."; put(2, 1, 'F'); put(2, 10, 'F'); }
        if (d.chest === 'stitch') { put(2, 4, 'fppf'); put(3, 4, 'pffp'); }
        if (d.centre) for (let i = 3; i <= 7; i++) put(i, 5, 'ff');
        if (d.sash) { c[6] = "..offffffo.."; c[7] = "..oFffffFo.."; }
        if (d.midSkirt) { c[6] = ".oKkkkkkkKo."; c[7] = ".okkkkkkkko."; }
        if (d.goreum) { put(5, 7, 'f'); put(6, 7, 'fF'); put(7, 7, 'fF'); }
    }
    /* an arm (4 wide, shoulder at the top) in national dress */
    function dressArm(rows, o, d) {
        rows = rows.slice();
        if (o.sleeves >= 2) {
            for (let i = 2; i <= 6; i++) rows[i] = 'ovvo';
            rows[7] = 'oVVo';
        }
        if (d.sleeve === 'puff') rows[2] = 'oVVo';
        if (d.sleeve === 'stitch') for (let i = 2; i <= 6; i++) rows[i] = 'ov' + (i % 2 ? 'p' : 'f') + 'o';
        if (d.sleeve === 'buttons') [2, 4, 6].forEach(i => { rows[i] = 'ovYo'; });
        if (d.shawl) { rows[0] = '.off'; rows[1] = 'ofFf'; rows[2] = rows[2].slice(0, 1) + 'F' + rows[2].slice(2); }
        return rows;
    }

    /* lola from the side, bent over for the side twerk: facing right,
       hips pushed back (left), knee bent, hand on the knee, face turned to
       us, hair hanging down her back. Each part is [y, x, 'pixels'] runs. */
    function spec(runs, colour) {
        let out = '';
        runs.forEach(function (r) {
            const y = r[0], x0 = r[1], str = r[2];
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
    function lolaSide(v) {
        v = v || lolaVariant();
        const P = lolaPalette(v);
        const col = ch => P[ch];
        /* the far leg, tucked behind the hips */
        const far = [
            [23, 6, 'otto'], [24, 6, 'otto'], [25, 6, 'otto'], [26, 6, 'ojjo'], [27, 6, 'ojjo'], [28, 6, 'ojjo'],
            [29, 5, 'onnno'], [30, 5, 'ogggo'],
        ];
        /* the torso, leaning forward about 40 degrees: tee, then midriff.
           The bust fills the tee out in front of the arm, rounding down to
           a shade under the curve and a shadow on her midriff. */
        const chest = [
            [10, 15, 'oso'],
            [11, 13, 'ouuuuo'],
            [12, 12, 'ouuuuuuuo'],
            [13, 11, 'owwwwwwwwwo'],
            [14, 10, 'owwwwwwwwwWo'],
            [15, 9, 'oWWWWWWWwWxo'],
            [16, 8, 'ommmmmMMoxxo'],
            [17, 16, 'ooo'],
            [17, 7, 'ommmmmMo'],
        ];
        /* the hips in leggings, pushed back */
        const hips = [
            [17, 4, 'oooKKKo'],
            [18, 3, 'okkkkkkkko'],
            [19, 2, 'okKkkkkkkkko'],
            [20, 2, 'okKkkkkkkkko'],
            [21, 2, 'okkkkkkkkkko'],
            [22, 3, 'okkkkkkkko'],
            [23, 4, 'ookkkkoo'],
        ];
        /* the near leg: thigh forward to the knee, shin back to the sneaker */
        const leg = [
            [21, 8, 'oTTTTo'],
            [22, 8, 'ottttTo'],
            [23, 9, 'ottttTo'],
            [24, 10, 'ottttTo'],
            [25, 11, 'ojjjjo'],
            [26, 11, 'ojjjo'],
            [27, 10, 'ojjjo'],
            [28, 10, 'ojjjo'],
            [29, 9, 'onnnnnno'],
            [30, 9, 'ogggggggo'],
        ];
        /* the near arm: short sleeve, down to the hand on the knee */
        const arm = [
            [11, 15, 'ovvo'],
            [12, 15, 'ovVo'],
            [13, 15, 'osso'],
            [14, 14, 'osso'],
            [15, 14, 'osso'],
            [16, 13, 'osso'],
            [17, 13, 'osSo'],
            [18, 13, 'osso'],
            [19, 13, 'osso'],
            [20, 12, 'osso'],
            [21, 12, 'osso'],
            [22, 12, 'osSo'],
            [23, 13, 'oo'],
        ];
        let head = [
            [2, 14, 'hhhh'],
            [3, 13, 'hhhhhh'],
            [4, 12, 'hhhhhhhh'],
            [5, 12, 'hhHhhhhh'],
            [6, 12, 'hhssssso'],
            [7, 12, 'hsesseso'],
            [8, 12, 'hssssSso'],
            [9, 12, 'ysssllso'],
            [10, 13, 'ossso'],
        ];
        /* her expression, simply: an open mouth, teeth, a blush */
        const sideMouth = { grin: 'ysssliso', sing: 'yssslaso', laugh: 'ysssiaso' }[v.face];
        if (sideMouth) head[7] = [9, 12, sideMouth];
        if (v.face === 'blush' || v.face === 'joy' || v.face === 'laugh') head[6] = [8, 12, 'hsbssSso'];
        const hang = { ponytail: true, long: true, braids: true }[v.hair];
        if (hang) head = [[3, 11, 'hH'], [4, 10, 'hH'], [5, 10, 'hh'], [6, 9, 'hH'], [7, 9, 'hh'], [8, 8, 'hH'],
                          [9, 8, 'hh'], [10, 7, 'hH'], [11, 7, 'hh'], [12, 6, 'hH'], [13, 6, 'h']].concat(head);
        if (v.hair === 'ponytail') head.push([3, 12, 'H']);
        if (v.hair === 'buns') head.unshift([1, 13, 'hH'], [1, 17, 'Hh']);
        if (v.hair === 'curly') head.unshift([2, 12, 'h'], [3, 11, 'hH'], [4, 11, 'h'], [5, 11, 'H'], [6, 11, 'h'], [7, 11, 'h']);
        if (v.hair === 'bob') head.push([7, 11, 'h'], [8, 11, 'hH'], [9, 11, 'h']);
        const d = dressOf(v);
        let farRuns = far, chestRuns = chest, hipRuns = hips, legRuns = leg, armRuns = arm;
        if (d) {
            const o = outfitEntry(v);
            const set = (runs, y, x, str) => { runs.forEach(r => { if (r[0] === y && r[1] === x) r[2] = str; }); };
            chestRuns = chest.map(r => r.slice());
            armRuns = arm.map(r => r.slice());
            if (d.sash) { set(chestRuns, 16, 8, 'offfffFFoxxo'); set(chestRuns, 17, 7, 'offfffFo'); }
            if (d.collar === 'lei') set(chestRuns, 11, 13, 'ocqcqo');
            if (d.collar === 'cross' || d.collar === 'bow') set(chestRuns, 11, 13, 'ouqquo');
            if (d.shawl) { set(chestRuns, 11, 13, 'offffo'); set(chestRuns, 12, 12, 'oFfFfFfFo'); }
            if (o.sleeves >= 2) armRuns = armRuns.map(r => (r[0] >= 13 && r[0] <= 19 ? [r[0], r[1], 'ovvo'] : r[0] === 20 ? [r[0], r[1], 'oVVo'] : r));
            if (d.sleeve === 'stitch') armRuns = armRuns.map(r => (r[0] >= 13 && r[0] <= 19 ? [r[0], r[1], 'ov' + (r[0] % 2 ? 'p' : 'f') + 'o'] : r));
            if (d.sleeve === 'buttons') armRuns = armRuns.map(r => (r[0] === 14 || r[0] === 16 || r[0] === 18 ? [r[0], r[1], 'ovYo'] : r));
            if (d.shawl) armRuns = armRuns.map(r => (r[0] <= 12 ? [r[0], r[1], 'offo'] : r));
            if (d.skirt) {
                /* the skirt hangs from her pushed-back hips over the thigh;
                   only the legs below its edge are drawn */
                const end = Math.max(17 + SKIRTS[d.skirt].length - 1, 24);
                hipRuns = sideSkirt(d, end);
                const sk = printer(v, 'skirt');
                if (sk) hipRuns = paintRuns(hipRuns, sk);
                legRuns = leg.filter(r => r[0] > end);
                farRuns = far.filter(r => r[0] > end);
            }
            if (d.head) head = head.concat(hatRuns(d.head, 6, 4));
            const top = printer(v, 'top');
            if (top) { chestRuns = paintRuns(chestRuns, top); armRuns = paintRuns(armRuns, top); }
        }
        return {
            legL: spec(legRuns, col), legR: '',
            hips: spec(hipRuns, col),
            chest: spec(farRuns, col) + spec(chestRuns, col),
            armL: '', armR: spec(armRuns, col),
            head: spec(head, col),
        };
    }
    /* the side view's skirt, y 17 down to `end`, flaring toward the knee */
    function sideSkirt(d, end) {
        const hw = SKIRTS[d.skirt], flare = Math.max(0, Math.min(3, Math.max.apply(null, hw) - 6));
        const span = { 17: [4, 10], 18: [3, 12], 19: [2, 13], 20: [2, 13], 21: [2, 14], 22: [2, 15], 23: [2, 15] };
        const runs = [];
        for (let y = 17; y <= end; y++) {
            const f = y >= 23 ? Math.min(flare, y - 22) : 0;
            const b = span[y] || [3, 16];
            const round = end - y === 0 ? 1 : 0;   /* soft corners on the edge */
            const x0 = b[0] - (y >= 24 ? f : 0) + round, x1 = b[1] + f - round, up = end - y;
            let str = '';
            for (let x = x0; x <= x1; x++) {
                let ch;
                if (up === 0 || x === x0 || x === x1) ch = 'o';
                else if (y === 17) ch = 'K';
                else if (up === 1 && d.hem) ch = d.hem === 'ruffle' ? (x % 2 ? 'K' : 'k') : d.hem;
                else if (d.bands && d.bands.indexOf(up) >= 0) ch = 'f';
                else if (d.tiers && y >= 22 && (y - 22) % 2 === 0 && y < end - 1) ch = d.tiers;
                else ch = y > 19 && (x - x0) % 4 === 2 ? 'K' : 'k';
                str += ch;
            }
            runs.push([y, x0, str]);
        }
        return runs;
    }

    /* lola from behind, bent over for the twerk: a wide squat, knees out,
       hands on the knees, the torso leaning away (so it looks short), the
       hips nearest us. look = her face peeking back over her shoulder. */
    function mirrorRuns(runs) { return runs.map(r => [r[0], 19 - (r[1] + r[2].length - 1), r[2].split('').reverse().join('')]); }
    function lolaBack(v, look) {
        v = v || lolaVariant();
        const P = lolaPalette(v);
        const col = ch => P[ch];
        /* from behind, long hair (and a ponytail) hangs over the nape */
        const neck = { long: 'hhhh', bob: 'hhhh', ponytail: 'ohHo' }[v.hair] || 'osso';
        /* look: a three-quarter peek — mostly the back of her head, her
           cheek, one eye, nose and lips showing at the edge */
        let head = look ? [
            [4, 7, 'hhhhhh'],
            [5, 6, 'hhhhhhhh'],
            [6, 5, 'oshhhhhhh'],
            [7, 4, 'oeshhhhhhs'],
            [8, 4, 'ossshhhhhh'],
            [9, 5, 'olshhhhhh'],
            [10, 6, 'oshhhhh'],
            [11, 8, neck],
            [8, 14, 'y'],
        ] : [
            [4, 7, 'hhhhhh'],
            [5, 6, 'hhhhhhhh'],
            [6, 6, 'hhhhhhhh'],
            [7, 5, 'shhhhhhhhs'],
            [8, 6, 'hhhhhhhh'],
            [9, 6, 'hhhhhhhh'],
            [10, 7, 'hhhhhh'],
            [11, 8, neck],
        ];
        const extra = {
            ponytail: [[5, 9, 'HH'], [6, 9, 'hH'], [7, 9, 'hH'], [8, 9, 'hH'], [9, 9, 'hH'], [10, 9, 'hH'], [11, 9, 'hH'], [12, 9, 'hH'], [13, 9, 'hH'], [14, 9, 'h']],
            long: [[10, 6, 'hhhhhhhh'], [11, 6, 'hhhhhhhh'], [12, 6, 'hhhhhhhh'], [13, 6, 'hHhhhhHh'], [14, 7, 'hhhhhh']],
            braids: [[10, 7, 'h'], [10, 12, 'h'], [11, 7, 'H'], [11, 12, 'H'], [12, 7, 'h'], [12, 12, 'h'], [13, 7, 'H'], [13, 12, 'H'], [14, 7, 'y'], [14, 12, 'y']],
            bob: [[10, 6, 'hhhhhhhh'], [11, 6, 'hHhhhhHh']],
            buns: [[3, 6, 'hh'], [3, 12, 'hh']],
            curly: [[4, 5, 'hhhhhhhhhh'], [5, 5, 'h'], [5, 14, 'h'], [6, 5, 'H'], [6, 14, 'H'], [8, 5, 'h'], [8, 14, 'h'], [9, 5, 'H'], [9, 14, 'H']],
            pixie: [],
        }[v.hair] || [];
        /* from behind long hair and braids hang down her back; a ponytail
           is part of the head (it moves with it), ending at the nape */
        const behindHead = v.hair === 'ponytail' ? [] : extra.slice();
        if (v.hair === 'ponytail') head = head.concat(extra.filter(r => r[0] <= 10));
        let chest = [
            [12, 5, 'ouuuuuuuuo'],
            [13, 4, 'owwwwwwwwwwo'],
            [14, 4, 'owwwwwwwwwwo'],
            [15, 5, 'oWWWWWWWWo'],
            [16, 4, 'oMmmmMMmmmMo'],
            [17, 4, 'oMmmmMMmmmMo'],
            /* the seat, inside the hips' own outline: when the hips bounce
               or rock, cloth shows here instead of a hole (nothing pokes
               out between her thighs) */
            [18, 5, 'kkkkkkkkkk'],
            [19, 4, 'kkkkkkkkkkkk'],
            [20, 4, 'kkkkkkkkkkkk'],
            [21, 4, 'kkkkkkkkkkkk'],
            [22, 5, 'kkkkkkkkkk'],
            [23, 6, 'kkkkkkkk'],
        ];
        /* two round cheeks: a shine (L) on each, a thin crease (D) only
           low down, and a small notch at the bottom */
        const hips = [
            [17, 5, 'okkkkkkkko'],
            [18, 4, 'okkLLkkLLkko'],
            [19, 3, 'okkLkkkkkkLkko'],
            [20, 3, 'okkkkkkkkkkkko'],
            [21, 3, 'okkkkkkDkkkkko'],
            [22, 4, 'okkkkkDkkkko'],
            [23, 5, 'okkkkokkko'],
        ];
        const legL = [[23, 3, 'ottto'], [24, 2, 'ottto'], [25, 2, 'otTto'], [26, 3, 'ojjjo'], [27, 4, 'ojjo'], [28, 4, 'ojjo'], [29, 3, 'onnnno'], [30, 3, 'oggggo']];
        let armL = [[12, 3, 'ovvo'], [13, 3, 'ovVo'], [14, 2, 'osso'], [15, 2, 'osso'], [16, 1, 'osso'], [17, 1, 'osso'], [18, 1, 'osso'],
                      [19, 1, 'osso'], [20, 1, 'osso'], [21, 1, 'osSo'], [22, 1, 'osso'], [23, 1, 'osso'], [24, 2, 'oo']];
        let hipRuns = hips;
        const d = dressOf(v);
        if (d) {
            const o = outfitEntry(v);
            const set = (runs, y, str) => { runs.forEach(r => { if (r[0] === y) r[2] = str; }); };
            if (d.sash) { set(chest, 16, 'oFffffffffFo'); set(chest, 17, 'offfffffffFo'); }
            if (d.collar === 'lei') set(chest, 12, 'ocqcqcqcqo');
            if (d.shawl) { set(chest, 12, 'offffffffo'); set(chest, 13, 'offffffffffo'); set(chest, 14, 'oFfFfFfFfFfo'); }
            if (d.bow) chest.push([14, 6, 'offooffo'], [15, 5, 'offfFFfffo'], [16, 6, 'offooffo']);
            if (d.collar === 'bow' || d.collar === 'cross') set(chest, 12, 'ouuqqqquuo');
            if (o.sleeves >= 2) {
                armL = armL.map(r => (r[0] >= 14 && r[0] <= 20 ? [r[0], r[1], 'ovvo'] : r[0] === 21 ? [r[0], r[1], 'oVVo'] : r));
                if (d.sleeve === 'stitch') armL = armL.map(r => (r[0] >= 14 && r[0] <= 20 ? [r[0], r[1], 'ov' + (r[0] % 2 ? 'p' : 'f') + 'o'] : r));
                if (d.sleeve === 'buttons') armL = armL.map(r => (r[0] === 15 || r[0] === 17 || r[0] === 19 ? [r[0], r[1], 'ovYo'] : r));
            }
            if (d.shawl) armL = armL.map(r => (r[0] <= 13 ? [r[0], r[1], r[0] === 12 ? 'offo' : 'oFfo'] : r));
            if (d.skirt) {
                const sk = printer(v, 'skirt');
                hipRuns = sk ? paintRuns(skirtRuns(d, 17, true), sk) : skirtRuns(d, 17, true);
            }
            if (d.head) head = head.concat(hatRuns(d.head, 0, 5));
            if (d.head === 'vinok') behindHead.push([11, 7, 'f'], [12, 7, 'p'], [13, 7, 'c'], [11, 12, 'p'], [12, 12, 'c'], [13, 12, 'f']);
            const top = printer(v, 'top');
            if (top) { chest = paintRuns(chest, top); armL = paintRuns(armL, top); }
        }
        return {
            head: spec(head, col), hairBack: spec(behindHead, col),
            chest: spec(chest, col), hips: spec(hipRuns, col),
            legL: spec(legL, col), legR: spec(mirrorRuns(legL), col),
            armL: spec(armL, col), armR: spec(mirrorRuns(armL), col),
        };
    }

    /* The partner: an original adult man who sometimes dances behind lola
       in the side twerk, hands on her waist. Random skin, hair, shirt, cap. */
    function partnerVariant() {
        const pick = arr => arr[Math.floor(Math.random() * arr.length)];
        return {
            skin: pick(['#f0c8a8', '#e0b088', '#c68a5e', '#9a6640', '#6e4a30']),
            hair: pick(['#1b1410', '#2a1a12', '#4a2c1a', '#6b3e22', '#c8964a']),
            shirt: pick(['#2f6fd6', '#e0405a', '#3ea84a', '#26262c', '#f5b400', '#ffffff', '#7a4fd0']),
            cap: Math.random() < 0.4 ? pick(['#e0405a', '#26262c', '#2f6fd6', '#f5b400']) : null,
        };
    }
    function partnerSprite(pv) {
        const P = { o: '#1e140e', s: pv.skin, S: shade(pv.skin, 0.82), t: pv.shirt, T: shade(pv.shirt, 0.75), j: '#3b5b8c', J: '#2c476e',
                    h: pv.hair, e: '#1e140e', n: '#ffffff', g: '#b0b0bc', c: pv.cap || pv.hair, C: shade(pv.cap || pv.hair, 0.7) };
        const col = ch => P[ch];
        const head = pv.cap ? [
            [1, -3, 'occcccco'], [2, -4, 'occccccCCCo'], [3, -4, 'ohhssssso'],
        ] : [
            [1, -3, 'ohhhhho'], [2, -4, 'ohhhhhhho'], [3, -4, 'ohhhhhsso'],
        ];
        const rest = [
            [4, -4, 'ohhSssseo'],
            [5, -4, 'ohhsssssso'],
            [6, -4, '.ohssssso'],
            [7, -3, 'osssSso'],
            [8, -2, 'ossso'],
            [9, -1, 'oso'],
        ];
        const body = [
            [10, -4, 'otttttto'],
            [11, -5, 'ottttttTto'], [12, -5, 'ottttttTto'], [13, -5, 'ottttttTto'], [14, -5, 'ottttttTto'],
            [15, -5, 'ottttttTto'], [16, -5, 'ottttttTto'], [17, -5, 'ottttttTto'],
            [18, -5, 'oTTTTTTTTo'],
            [19, -5, 'ojjjjjjjjo'], [20, -5, 'ojjjjjJjjo'], [21, -5, 'ojjjjjjjjo'],
            /* far leg, then near leg */
            [22, -5, 'ojJjo'], [23, -5, 'ojJjo'], [24, -5, 'ojJjo'], [25, -5, 'ojJjo'], [26, -5, 'ojJjo'], [27, -5, 'ojJjo'], [28, -5, 'ojJjo'],
            [29, -6, 'onnno'], [30, -6, 'ogggo'],
            [22, -1, 'ojjjo'], [23, -1, 'ojjjo'], [24, 0, 'ojjjo'], [25, 0, 'ojjJo'], [26, 0, 'ojjjo'], [27, 0, 'ojjjo'], [28, 0, 'ojjjo'],
            [29, 0, 'onnnnnno'], [30, 0, 'oggggggo'],
        ];
        /* the near arm, reaching forward to her waist */
        const arm = [[11, 1, 'otto'], [12, 2, 'otto'], [13, 3, 'osso'], [14, 4, 'osso'], [15, 5, 'osso'], [16, 6, 'osssso'], [17, 7, 'osSso'], [18, 8, 'ooo']];
        return { body: spec(head.concat(rest).concat(body), col), arm: spec(arm, col) };
    }

    /* ── Seam-free rendering ───────────────────────────────────── */
    /* Every colour run is its own <rect>; scaled by a non-integer factor and
       rotated, neighbouring rects leave hairlines between them. So in the
       browser each skeleton part (a <g> holding only rects) is painted once
       to a small canvas, cropped to the part's own drawn pixels (so the
       <g>'s fill-box, and every transform-origin in grid.css, stays exactly
       what the rects gave), and drawn as one pixelated <image> over its
       rects. Cached by markup; without a document or canvas (node tests)
       only the rects are drawn. */
    const RECT = /<rect x="(-?\d+)" y="(-?\d+)" width="(\d+)" height="(\d+)" fill="(#[0-9a-fA-F]{3,8})"\/>/g;
    const BAKED = new Map();
    let bakeCanvas = null;
    function bake(inner) {
        if (!inner || typeof document === 'undefined' || !document.createElement) return inner;
        const hit = BAKED.get(inner);
        if (hit) return hit;
        const rects = [];
        const rest = inner.replace(RECT, function (m, x, y, w, h, f) { rects.push([+x, +y, +w, +h, f]); return ''; });
        if (rest.trim() || !rects.length) return inner;
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        rects.forEach(function (r) {
            x0 = Math.min(x0, r[0]); y0 = Math.min(y0, r[1]);
            x1 = Math.max(x1, r[0] + r[2]); y1 = Math.max(y1, r[1] + r[3]);
        });
        const w = x1 - x0, h = y1 - y0;
        let url;
        try {
            bakeCanvas = bakeCanvas || document.createElement('canvas');
            bakeCanvas.width = w; bakeCanvas.height = h;
            const ctx = bakeCanvas.getContext && bakeCanvas.getContext('2d');
            if (!ctx) return inner;
            ctx.clearRect(0, 0, w, h);
            rects.forEach(function (r) { ctx.fillStyle = r[4]; ctx.fillRect(r[0] - x0, r[1] - y0, r[2], r[3]); });
            url = bakeCanvas.toDataURL('image/png');
        } catch (e) { return inner; }
        if (!url || url.indexOf('data:image/png') !== 0) return inner;
        /* the rects stay underneath, crisp-edged: where two parts meet
           (an image's edge pixels are only partly covered at a fractional
           scale) they fill the gap, and the image's opaque inside hides
           their own hairlines when the part turns */
        const out = inner + '<image x="' + x0 + '" y="' + y0 + '" width="' + w + '" height="' + h + '" preserveAspectRatio="none"' +
                    ' style="image-rendering:crisp-edges;image-rendering:pixelated" href="' + url + '"/>';
        if (BAKED.size > 800) BAKED.clear();
        BAKED.set(inner, out);
        return out;
    }
    /* bake every <g> whose content is rects only (the skeleton parts, the
       instruments, the partner). A part may hold overlay groups one level
       down (OVERLAYS: a .bust inside the chest): the part's own rects AND
       the overlay's are baked together as one image underneath (so nothing
       shows through when the overlay moves), then each overlay is baked as
       its own image on top. Groups holding only groups (.upper) bake each
       child in place; deeper nesting is left to the inner groups. */
    const OVERLAYS = /\bclass="(?:[^"]*\s)?bust(?:\s[^"]*)?"/;
    const RECT_GROUP = /<g\b[^>]*>(?:<rect\b[^>]*\/>)*<\/g>/g;
    const PART_GROUP = /(<g\b[^>]*>)((?:<rect\b[^>]*\/>|<g\b[^>]*>(?:<rect\b[^>]*\/>)*<\/g>)*)(<\/g>)/g;
    function bakeGroup(gm) {
        const m = /^(<g\b[^>]*>)([\s\S]*)(<\/g>)$/.exec(gm);
        return m[1] + bake(m[2]) + m[3];
    }
    function bakeAll(markup) {
        if (typeof document === 'undefined') return markup;
        return markup.replace(PART_GROUP, function (m, open, inner, close) {
            const kids = inner.match(RECT_GROUP);
            if (!kids) return open + bake(inner) + close;
            const own = inner.replace(RECT_GROUP, '');
            const overlay = kids.some(k => OVERLAYS.test(k.slice(0, k.indexOf('>') + 1)));
            if (overlay) {
                const all = own + kids.map(k => k.replace(/^<g\b[^>]*>|<\/g>$/g, '')).join('');
                return open + bake(all) + kids.map(bakeGroup).join('') + close;
            }
            if (own) return open + bake(own) + kids.map(bakeGroup).join('') + close;
            return open + inner.replace(RECT_GROUP, bakeGroup) + close;
        });
    }
    /* wrap bust rows (part of a front chest) so they jiggle on their own */
    function bustGroup(inner) { return inner ? '<g class="bust">' + inner + '</g>' : ''; }

    /* ── Layouts: a character's parts → the skeleton markup ─────── */
    const g = (cls, inner) => '<g class="' + cls + '">' + (inner || '') + '</g>';
    /* standing (every .mv-* move): legs, then the upper body; from behind
       (view 'back' / 'look') the hips come in front of the chest */
    /* inst (front view only, see figure()): { id, back, front, stage }
       markup from MGInstruments.sprite. back sits in .upper over the chest
       and under the arms, front over the arms (under the head), stage in
       .fig in front of the legs and behind .upper (a floor kit) */
    function layStand(p, view, inst) {
        const back = view && view !== 'front';
        const torso = back ? g('chest', p.chest) + g('hips', p.hips) : g('hips', p.hips) + g('chest', p.chest);
        const ig = (where, m) => inst && m ? g('instrument inst-' + where + ' inst-' + inst.id, m) : '';
        return '<g class="fig" shape-rendering="crispEdges">' + g('leg leg-l', p.legL) + g('leg leg-r', p.legR) +
               ig('stage', inst && inst.stage) +
               '<g class="upper">' + torso + ig('back', inst && inst.back) +
               /* inst.over (a horn at the mouth): the far arm behind the
                  head, the near arm and the instrument in front of it */
               (inst && inst.over
                 ? g('arm arm-l', p.armL) + g('head', p.head) + g('arm arm-r', p.armR) + ig('front', inst.front)
                 : g('arm arm-l', p.armL) + g('arm arm-r', p.armR) + ig('front', inst && inst.front) + g('head', p.head)) +
               '</g></g>';
    }
    /* the posed twerk from behind (.pose: only the hips and head move, the
       whole figure dips); hairBack is drawn over the chest */
    function layPose(p) {
        return '<g class="fig pose" shape-rendering="crispEdges"><g class="upper">' + g('chest', (p.chest || '') + (p.hairBack || '')) +
               g('arm arm-l', p.armL) + g('arm arm-r', p.armR) + g('leg leg-l', p.legL) + g('leg leg-r', p.legR) +
               g('hips', p.hips) + g('head', p.head) + '</g></g>';
    }
    /* the side twerk, drawn back to front: far leg + torso (chest), hips,
       near leg (legL), near arm (armR), head */
    function laySide(p) {
        return '<g class="fig" shape-rendering="crispEdges"><g class="upper">' + g('chest', p.chest) + g('hips', p.hips) +
               g('leg leg-l', p.legL) + g('leg leg-r', p.legR) + g('arm arm-l', p.armL) + g('arm arm-r', p.armR) +
               g('head', p.head) + '</g></g>';
    }
    function lay(p, view, inst) {
        const layout = p.layout || (view === 'side' ? 'side' : 'stand');
        return layout === 'pose' ? layPose(p) : layout === 'side' ? laySide(p) : layStand(p, view, inst);
    }

    /* ── The registry ──────────────────────────────────────────── */
    /* MGMascots.register(name, def) adds (or replaces) a mascot:
         def.variant(ctx)     a random look (any object; null if none);
                              ctx = { country, genre } of the song (optional),
                              e.g. kit.pickOutfit(null, table, ctx.country)
         def.restyle(v, ctx)  the same look in other clothes (default: v)
         def.faces            optional: the expressions it can draw, all
                              positive (['smile', 'grin', 'joy', 'wink', 'sing',
                              'laugh', 'blush']; default ['smile']). The front
                              head reads v.face (missing/unknown = 'smile');
                              MGMascots.express() rolls a new one
         def.hold             optional { x, y }: where an instrument sits on
                              this body, offset from lola's (default 0, 0)
         def.parts(view, v)   standing parts { legL legR hips chest armL armR
                              head } for view 'front' | 'back' | 'look'
         def.pose(v, look)    optional: the posed twerk from behind (look =
                              peeking back) { head hairBack chest hips legL
                              legR armL armR }; used for 'back' / 'look'
         def.side(v)          optional: the side twerk { chest hips legL armR
                              head } (legR / armL may be '')
         def.single(view, v)  optional, overrides the three above: a markup
                              string ('<g class="fig ...">' with the skeleton)
                              or a parts object (layout: 'stand'|'pose'|'side')
         def.views            { back, look, side }: which twerk views it has
         def.twerk            false = never twerks (and never joins a crew)
         def.partner          true = may get the partner in the side twerk
       Every part is markup made of <rect>s only (kit.pix / kit.spec /
       kit.block); figure() bakes each one into a seam-free image. A front
       chest may wrap its bust rows in kit.bustGroup(rects) (<g class="bust">)
       to jiggle on the beat; bakeAll bakes it as its own image. */
    const ORDER = ['lola', 'moe', 'matrix', 'crt'];
    const NAMES = [];
    const REG = {};
    const noTwerk = {}, side = {}, look = {}, partnered = {};
    function register(name, def) {
        REG[name] = def;
        const views = def.views || {};
        if (def.twerk === false) noTwerk[name] = true; else delete noTwerk[name];
        if (views.side && def.twerk !== false) side[name] = true; else delete side[name];
        if (views.look && def.twerk !== false) look[name] = true; else delete look[name];
        if (def.partner) partnered[name] = true; else delete partnered[name];
        if (NAMES.indexOf(name) < 0) NAMES.push(name);
        /* the cast order: lola, moe, matrix, crt, then anyone else */
        const rank = n => { const i = ORDER.indexOf(n); return i < 0 ? ORDER.length : i; };
        const sorted = NAMES.slice().sort((a, b) => rank(a) - rank(b) || NAMES.indexOf(a) - NAMES.indexOf(b));
        NAMES.length = 0;
        sorted.forEach(n => NAMES.push(n));
    }

    register('lola', {
        variant: lolaVariant,
        restyle: restyle,
        parts: lolaParts,
        pose: lolaBack,
        side: lolaSide,
        views: { back: true, look: true, side: true },
        twerk: true,
        partner: true,
        faces: FACES, sadFaces: SAD_FACES, extraFaces: ['skyward'],
        outfits: OUTFITS,
    });
    register('crt', {
        parts: function (view) {
            const p = themeParts('crt', view === 'look' ? 'back' : view);
            /* looking back over the shoulder: the body from behind, the screen to us */
            if (view === 'look') p.head = headRects('crt', false);
            return p;
        },
        views: { back: true, look: false, side: false },
        twerk: true,
        hold: { x: 0, y: 5 },
    });

    /* One dancer, without company (raw rect markup) */
    function single(name, view, v, inst) {
        const def = REG[name] || REG.lola;
        if (def.single) {
            const r = def.single(view, v);
            return typeof r === 'string' ? r : lay(r, view, view === 'front' ? inst : null);
        }
        if (view === 'side' && def.side) return laySide(def.side(v));
        if ((view === 'back' || view === 'look') && def.pose) return layPose(def.pose(v, view === 'look'));
        /* no side view: stand facing away instead */
        return layStand(def.parts(view === 'side' ? 'back' : view, v), view === 'side' ? 'back' : view,
                        view === 'front' ? inst : null);
    }
    /* opts.instrument (an MGInstruments id) → { id, back, front, stage },
       shifted by the mascot's def.hold; null when unknown */
    function instrumentLayers(name, id) {
        const I = typeof window !== 'undefined' && window.MGInstruments;
        if (!id || !I || !I.sprite) return null;
        const hold = (REG[name] && REG[name].hold) || {};
        const sp = I.sprite(id, { dx: hold.x || 0, dy: hold.y || 0 });
        return sp ? { id: id, back: sp.back || '', front: sp.front || '', stage: sp.stage || '', over: !!sp.over } : null;
    }

    /* The figure. opts.partner (a partnerVariant, side view only): the man
       behind the dancer, hands on her waist. opts.crew ([{ name, v }], one
       or two): company twerking from behind beside the dancer, who stays in
       the middle. opts.instrument (an MGInstruments id, front view, no
       company): the dancer plays it (see layStand for the layers). Size
       the stage with MGMascots.viewBox(opts). */
    function figure(name, view, v, opts) {
        if (view === true) view = 'back';
        view = view || 'front';
        opts = opts || {};
        let out;
        if (opts.partner && view === 'side') {
            const pp = partnerSprite(opts.partner);
            out = '<g class="partner" shape-rendering="crispEdges">' + pp.body + '</g>' +
                  '<g transform="translate(3 0)">' + single(name, view, v) + '</g>' +
                  '<g class="partner" shape-rendering="crispEdges">' + pp.arm + '</g>';
        } else if (opts.crew && opts.crew.length) {
            const crew = opts.crew;
            const at = crew.length === 1 ? [10] : [-20, 20];
            const main = crew.length === 1 ? -10 : 0;
            out = crew.map((c, i) => '<g transform="translate(' + at[i] + ' 0)"><g class="crew">' + single(c.name, 'back', c.v) + '</g></g>').join('') +
                  '<g transform="translate(' + main + ' 0)">' + single(name, view, v) + '</g>';
        } else {
            out = single(name, view, v, view === 'front' ? instrumentLayers(name, opts.instrument) : null);
        }
        return bakeAll(out);
    }

    /* ── The kit: what a character file (mascot-*.js) builds with ── */
    /* Coordinates: one unit = one pixel, the figure in VIEWBOX '-6 -8 32 40'
       (x -6..26, y -8..32; lola's feet end at y 30). Pixel art goes through
       pix(rows, ox, oy, colour) (a grid of letters, '.' transparent) or
       spec(runs, colour) (runs [y, x, 'letters']); colour(ch) → '#rrggbb'
       (usually ch => P[ch] for a palette P). mirror(rows) / mirrorRuns(runs)
       flip left↔right about x = 9.5 (lola's centre line).

       Lola's letters (lolaPalette(v, base, table) resolves them):
         o outline   s S skin (S shade)   e eyes   l lips   y earrings
         h H hair (H = 0.7 shade)
         u U  the top above the bust (shoulders, upper back): cloth or skin
         w W x  the bust: always the top (W shade, x under the curves)
         v V  sleeves on the arms      m M  midriff (dress: cloth)
         k K  hips: always the bottoms (K shade)
         D    the crease between the cheeks   L  the shine on the cheeks
         t T  thighs                   j J  shins
         n g  shoes (upper, sole); sandals: n = skin, g = the top's colour
       An outfit (OUTFITS[name]: { w weight, top [..], upper, sleeves, mid,
       bottom [..] | 'same', thigh, shin, shoes [SHOES keys] }) decides for
       each region whether it is cloth or skin; pickOutfit(not, table) rolls
       one ({ name, top, bottom, shoes }) and the variant carries it as
       v.outfit. A national outfit adds countries: ['japan', ...]; pass the
       song's country as pickOutfit(not, table, country) and it is worn ~45%
       of the time to songs from there, never otherwise. A character with its own outfits passes its own table to
       both pickOutfit and lolaPalette, and its own letters as `base`
       (any extra letters you invent just need a colour in the palette).

       Parts: lolaParts(view, v) / lolaBack(v, look) / lolaSide(v) return
       { legL legR hips chest armL armR head (+ hairBack) } strings: copy
       their shapes (or call them) and swap rows for your own. Pivots come
       from each part's drawn bounding box (grid.css: arm 50% 10% = the
       shoulder, leg 50% 0% = the hip joint, head 50% 100% = the neck, hips
       50% 50%, .pose hips 50% 90%), so keep arms hanging from the shoulder
       and legs from the hip like lola's. Keep every part rects-only. */
    const kit = {
        pix: pix, spec: spec, block: block, shade: shade, mirror: mirror, mirrorRuns: mirrorRuns,
        rowsAt: rowsAt, clothShades: clothShades, pick: arr => arr[Math.floor(Math.random() * arr.length)],
        lolaParts: lolaParts, lolaBack: lolaBack, lolaSide: lolaSide, lolaPalette: lolaPalette,
        lolaVariant: lolaVariant, lolaRestyle: restyle, lolaHairLayers: lolaHairLayers,
        pickOutfit: pickOutfit, OUTFITS: OUTFITS, SHOES: SHOES, SKINS: SKINS, FAIR_HAIR: FAIR_HAIR,
        HAIR_STYLES: HAIR_STYLES, HAIR_COLOURS: HAIR_COLOURS, LOLA: LOLA, LOLA_FACE: LOLA_FACE, CAP: CAP,
        partnerSprite: partnerSprite,
        layStand: layStand, layPose: layPose, laySide: laySide, bake: bake, bakeAll: bakeAll,
        pickOutfitName: pickOutfitName, NATIONAL_ODDS: NATIONAL_ODDS, bustGroup: bustGroup,
        FACES: FACES, FACE_ROWS: FACE_ROWS, lolaFaceRows: faceRows,
    };
    /* the expressions a mascot can draw (at least ['smile']) */
    function faces(name) {
        const d = REG[name];
        return (d && d.faces && d.faces.length ? d.faces : ['smile']).slice();
    }
    /* a copy of v with a different random face (v itself when there's no
       other face to pick, or no v) */
    /* mood 'sad': pick from the mascot's sad faces instead */
    function express(name, v, mood) {
        if (!v || typeof v !== 'object') return v;
        const cur = v.face || 'smile';
        const d = REG[name];
        const pool = mood === 'sad' ? ((d && d.sadFaces) || []) : faces(name);
        const others = pool.filter(f => f !== cur);
        if (!others.length) return v;
        return Object.assign({}, v, { face: others[Math.floor(Math.random() * others.length)] });
    }

    window.MGMascots = {
        names: NAMES,   /* live: register() keeps it in cast order */
        register: register,
        kit: kit,
        figure: figure,
        /* ctx = { country, genre } of the song (optional) */
        variant: function (name, ctx) { const d = REG[name]; return d && d.variant ? d.variant(ctx || null) : null; },
        /* the same look in a different outfit (unchanged when it has none) */
        restyle: function (name, v, ctx) { const d = REG[name]; return d && d.restyle ? d.restyle(v, ctx || null) : v; },
        faces: faces,
        express: express,
        /* v showing one exact face (no-op when the mascot doesn't have it) */
        withFace: function (name, v, face) {
            const d = REG[name];
            if (!v || typeof v !== 'object' || !d) return v;
            const has = (d.faces || []).concat(d.sadFaces || [], d.extraFaces || []).indexOf(face) >= 0;
            return has && v.face !== face ? Object.assign({}, v, { face: face }) : v;
        },
        /* is v dressed in a national outfit (an outfits entry with
           countries)? dancer.js never twerks in one */
        national: function (name, v) {
            const d = REG[name], o = v && v.outfit, t = d && d.outfits;
            return !!(o && t && t[o.name] && t[o.name].countries);
        },
        partnerVariant: partnerVariant,
        /* company needs a wider stage */
        viewBox: function (opts) {
            const n = opts && opts.crew ? opts.crew.length : 0;
            return n === 2 ? '-27 -8 74 40' : n === 1 ? '-17 -8 54 40' : '-6 -8 32 40';
        },
        noTwerk: noTwerk,       /* mascots that dance reggaeton without twerking */
        side: side,             /* who has a side view (the side twerk) */
        look: look,             /* who can twerk looking back over the shoulder */
        partnered: partnered,   /* who may get the partner in the side twerk */
        VIEWBOX: '-6 -8 32 40',
    };
})();
