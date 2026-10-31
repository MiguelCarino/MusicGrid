/* MusicGrid — "matrix", an original adult man dancer, pixel by pixel.
 *
 * Same skeleton and size as lola (mascots.js) so every .mv-* move fits:
 * broader shoulders (x 0–19 with the arms), a flat chest, a short neck, a
 * square jaw with brows. Every time he comes on he rolls a skin tone (light
 * to deep), an eye colour, a hairstyle (crop, fade, buzz, curly top, man
 * bun, slick back, a cap or a beanie now and then), a hair colour, maybe
 * stubble, a goatee or a beard, and an outfit he swaps while he dances
 * (restyle): tee + jeans, tank + shorts, hoodie + joggers, button shirt +
 * chinos, a tracksuit, swim shorts (shirtless), or the "matrix" look — all
 * black, high collar, boots and dark shades (shades turn up now and then
 * with the other outfits too).
 *
 * To a song from some countries he may dress for it (national outfits,
 * countries: [...], worn ~45% of the time there, never elsewhere): a
 * mariachi charro suit (+ sombrero), a yukata or a happi coat (+ headband),
 * a hanbok, a kosovorotka (+ ushanka), a vyshyvanka, a Romanian cămașă, an
 * aloha shirt (+ lei), a traje corto (+ cordobés), a gaucho's vest and
 * rastra (+ boina), Colombian whites (+ sombrero vueltiao), a liqui liqui,
 * a guayabera (+ straw hat), a mod suit, a samba malandro's white suit,
 * a lopapeysa / Nordic knit, a marinière. Respectful, no costumes-as-jokes.
 *
 * Expressions (v.face, all positive): smile, grin, joy (^ ^ eyes), wink,
 * sing, laugh, cool (shades on, a smirk). Faces are row swaps of FACE; the
 * beard letters stay around an open mouth.
 *
 * Views: front; back (the posed twerk from behind: wide squat, hands on
 * the knees, hips nearest us, a seat under the hips so nothing opens up
 * when they bounce); look (the same, peeking back over his shoulder in
 * three-quarter). No side view (side: false).
 *
 * His letters (his own palette, built in palette(v)):
 *   o outline   s S skin   e eyes   B brows   m mouth   z Z beard (jaw, chin)
 *   k teeth   O open mouth
 *   G Y shades (lens, glint)   h H hair   f fade (hair into skin)
 *   E the hair low at the back   q Q cap / beanie / hat   y hat band
 *   X a detail (button, zip, logo, hair tie)   u U shoulders   c C x torso
 *   d trim (collar, strings, straps)   r stripe (tracksuit)   v V sleeve
 *   w W forearm   b belt / waistband   M buckle   p P bottoms   K pockets
 *   L shine   D crease   a A upper thigh   t T knee   j J shin   i I ankle
 *   (sock / cuff)   R leg stripe   n N g shoes (upper, accent, sole)
 *   1 2 3 4 5 9  a national outfit's own colours (trim, embroidery,
 *   studs, the shirt under a jacket, a vest), 6 7 8  lei flowers + leaves
 * Each outfit decides which regions are cloth and which are skin.
 * Loads after mascots.js and before dancer.js.
 */
(function () {
    'use strict';
    const M = window.MGMascots;
    if (!M || !M.register) return;
    const K = M.kit;
    const pick = K.pick, shade = K.shade;

    /* mix two #rrggbb colours (k = share of b) */
    function mix(a, b, k) {
        const A = parseInt(a.slice(1), 16), B = parseInt(b.slice(1), 16);
        const ch = s => Math.round(((A >> s) & 255) * (1 - k) + ((B >> s) & 255) * k);
        return '#' + [16, 8, 0].map(ch).map(c => c.toString(16).padStart(2, '0')).join('');
    }

    /* ── His looks ─────────────────────────────────────────────── */
    const SKINS = {
        light: { s: '#f6d6c2', S: '#e2b29a', o: '#3a2420' },
        peach: { s: '#eebf98', S: '#d49c74', o: '#2e1c16' },
        olive: { s: '#d4a070', S: '#b78054', o: '#2a1a12' },
        brown: { s: '#a8704a', S: '#8a5636', o: '#1e120c' },
        deep:  { s: '#7a4c30', S: '#5e3822', o: '#120a06' },
    };
    const EYES = ['#3a2216', '#1e1410', '#7a5a2a', '#3a78d8', '#3a9a5a', '#6a7a8a'];
    const HAIR = ['#141010', '#141010', '#2a1a12', '#2a1a12', '#4a2c1a', '#6b3e22', '#d8b050', '#a8844a', '#b0502a', '#9a9aa2'];
    const HAIR_RARE = ['#e0dccc', '#3ac060'];   /* platinum, a matrix green */
    const STYLES = ['crop', 'crop', 'fade', 'fade', 'buzz', 'curly', 'bun', 'slick', 'slick', 'cap', 'beanie'];
    const HATS = ['#e0405a', '#26262c', '#2f6fd6', '#f5b400', '#3a7a4a', '#f4f4f8', '#7a4fd0'];

    /* ── Row helpers (work on rows of letters or on [y, x, 'run']s) ── */
    const str = r => Array.isArray(r) ? r[2] : r;
    const put = (r, s) => Array.isArray(r) ? [r[0], r[1], s] : s;
    /* every cloth letter of a row (not outline, not '.') becomes ch */
    const fill = (r, ch) => put(r, str(r).replace(/[^o.]/g, ch));
    /* the first letter inside the outline (the outer edge of a left limb) */
    const edge = (r, ch) => put(r, str(r).replace(/o[^o.]/, 'o' + ch));
    const mapRows = (rows, idx, fn) => rows.map((r, i) => idx.indexOf(i) >= 0 ? fn(r, i) : r);

    /* His outfits (w = weight). top/bottom: colours to pick from ('same' =
       the top's); accent: stripe / print / sneaker / trim colours. Regions:
         body   the chest template      upper  shoulders in cloth
         sleeve short sleeves in cloth  long   long sleeves
         thigh  upper thigh in cloth    knee   knee / lower thigh
         shin   the shins in cloth      cuff   a cuff at the ankle
         belt   a belt with a buckle    pockets  back pockets
         stripe stripes down the arms and legs
       National outfits add countries: [...] and may add
         tuck   the chest stops above the hips (the belt shows)
         hats   [kind, ...] (+ hatOdds): HATWEAR keys, one maybe worn
         hatCol colours for the hat     lei  odds of a flower lei
         boots  high boots (the shins in boot leather)
         paint(P, of, T, B)  its own letters (1 2 3 4 5 9 …)
         arm / leg (rows, pose)  edits of the arm / leg rows (front + back
                share ARM / LEG; pose = the bent-over runs)
         back(rows) / pose(runs)  edits of the back / bent-over torso
         hipsF / hipsB  front / back hip rows; poseHips(runs) */
    const OUTFITS = {
        tee:    { w: 3, body: 'tee', top: ['#f4f4f8', '#1c1c22', '#8a8a94', '#2a3a6a', '#c83a3a', '#5a6a3a', '#d8a830'],
                  bottom: ['#3b5b8c', '#2c3e5c', '#5a7ab0', '#2a2a30'], upper: 1, sleeve: 1, thigh: 1, knee: 1, shin: 1,
                  belt: 1, pockets: 1, shoes: ['sneakers', 'sneakers', 'hightops'], print: 0.5 },
        tank:   { w: 2, body: 'tank', top: ['#f4f4f8', '#1c1c22', '#e05050', '#30a0d0', '#f0c030', '#8a8a94'],
                  bottom: ['#3b5b8c', '#2a2a30', '#6a7a4a', '#c8b08a'], thigh: 1, knee: 1, pockets: 1,
                  shoes: ['sneakers', 'sandals'] },
        hoodie: { w: 2, body: 'hoodie', top: ['#3a3a44', '#7a1a2a', '#2a4a7a', '#6a6a72', '#d86a2a', '#2a5a3a'],
                  bottom: ['#2a2a30', '#5a5a64', '#1c2a44'], upper: 1, sleeve: 1, long: 1, thigh: 1, knee: 1, shin: 1, cuff: 1,
                  shoes: ['sneakers', 'hightops'] },
        shirt:  { w: 2, body: 'shirt', top: ['#f4f4f8', '#a8c8ec', '#e8d8c0', '#d06060', '#2a3a5a', '#5a8a6a'],
                  bottom: ['#c8b08a', '#2a3a5a', '#6a6a5a', '#3a3a3a'], upper: 1, sleeve: 1, long: 1, thigh: 1, knee: 1, shin: 1,
                  belt: 1, pockets: 1, shoes: ['loafers', 'boots', 'sneakers'] },
        track:  { w: 2, body: 'track', top: ['#1c1c22', '#2a3a8a', '#c82a3a', '#2a7a4a', '#5a2a8a'], bottom: 'same',
                  upper: 1, sleeve: 1, long: 1, thigh: 1, knee: 1, shin: 1, stripe: 1, shoes: ['sneakers'],
                  accent: ['#f4f4f8', '#f0c030'] },
        swim:   { w: 1, body: 'bare', top: ['#e04a3a', '#2aa0d0', '#f0a020', '#3ac08a', '#ff6aa0', '#2a3a8a'], bottom: 'same',
                  thigh: 1, shoes: ['sandals', 'bare'] },
        matrix: { w: 1, body: 'agent', top: ['#16181c'], bottom: ['#16181c'], upper: 1, sleeve: 1, long: 1, thigh: 1, knee: 1,
                  shin: 1, belt: 1, shoes: ['boots'], shades: 1 },

        /* ── National outfits ── */
        /* Mexico: a mariachi charro suit — short jacket and trousers with
           a line of silver (or gold) botonadura, a white shirt, a big moño */
        charro: { w: 3, countries: ['mexico'], body: 'charro', top: ['#16181c', '#16181c', '#3a1a1e', '#d8ccb0', '#3a3e48'],
                  bottom: 'same', upper: 1, sleeve: 1, long: 1, thigh: 1, knee: 1, shin: 1, belt: 1, shoes: ['boots'],
                  accent: ['#c8202a', '#c8202a', '#1c1c22', '#2a6a3a'], hats: ['sombrero'], hatOdds: 0.7, tuck: 1,
                  paint: (P, of) => {
                      const cream = of.top === '#d8ccb0';
                      P[1] = cream ? '#8a1a22' : of.accent; P[2] = shade(P[1], 0.7);
                      P[3] = cream ? '#b08a3a' : '#d4d4dc';
                      P[4] = '#f4f4f0'; P[5] = '#d8d8e0';
                      P.M = P[3]; P.y = P[3];
                  },
                  arm: rows => mapRows(rows, [3, 5, 7], r => edge(r, '3')),
                  leg: (rows, pose) => mapRows(rows, pose ? [0, 2, 4] : [0, 2, 4, 6], r => edge(r, '3')) },
        /* Japan: a yukata — a cotton robe crossed left over right (the
           collar a "y"), a sash (obi) low on the hips, geta */
        yukata: { w: 2, countries: ['japan'], body: 'yukata', top: ['#26305a', '#3a3a42', '#4a5a74', '#5a4030', '#d8dce8'],
                  bottom: 'same', upper: 1, sleeve: 1, long: 1, thigh: 1, knee: 1, shin: 1, belt: 1, tuck: 1,
                  shoes: ['geta'], accent: ['#c8b08a', '#3a3a42', '#7a2a2a', '#5a6a4a'],
                  paint: (P, of, T) => {
                      const light = of.top === '#d8dce8';
                      P.d = light ? '#26305a' : T[1];
                      P.X = light ? '#4a5a7a' : mix(of.top, '#f4f4f8', 0.35);
                      P.b = of.accent; P.M = of.accent; P[1] = shade(of.accent, 0.78);
                      P.K = of.top; P.D = T[0];
                  },
                  arm: rows => mapRows(rows, [8], r => put(r, 'ossSo')),
                  hipsF: ['obbbbbbbbbbo', 'opppdppppppo', 'oppdpppppPpo', 'oppdppppppPo'],
                  hipsB: ['obbbb11bbbbo', 'oppppDppppPo', 'oPpppDppppPo', 'oPpppDppppPo'],
                  poseHips: runs => mapRows(runs, [0], r => put(r, 'obbb11bbbo')) },
        /* Japan: a happi festival coat (contrasting collar bands, a sash,
           a plain crest on the back), fitted momohiki, tabi, a headband */
        happi:  { w: 2, countries: ['japan'], body: 'happi', top: ['#c8302a', '#22306a', '#f0f0ec', '#1c4a6a'],
                  bottom: ['#1c2440', '#26262c', '#f0f0ec'], upper: 1, sleeve: 1, thigh: 1, knee: 1, shin: 1,
                  shoes: ['tabi'], hats: ['hachimaki'], hatOdds: 0.7, hatCol: ['#f4f4f0', '#c8302a', '#22306a'],
                  paint: (P, of) => {
                      const white = of.top === '#f0f0ec';
                      P.d = white ? '#22306a' : of.top === '#c8302a' ? '#f4f4f0' : '#f0f0ec';
                      P[1] = white ? '#c8302a' : '#1c1c22'; P[4] = '#26262c'; P[3] = P.d;
                      if (of.bottom === of.top) P.p = '#26262c';
                  },
                  back: r => { r[3] = 'occcc3333cccCo'; r[4] = 'occc3cccc3ccCo'; r[5] = 'occcc3333cccCo'; r[6] = '.o1111111111o.'; return r; },
                  pose: runs => { runs[2] = [13, 3, 'occcc3333ccCCo']; runs[3] = [14, 4, 'o1111111111o']; return runs; } },
        /* Korea: a hanbok-inspired jeogori (white collar band, a ribbon
           tie) over baji banded at the ankle, rubber shoes */
        hanbok: { w: 3, countries: ['korea'], body: 'hanbok', top: ['#f4f0e6', '#a8d0e0', '#c8e0c0', '#e8d0a0', '#2a3a6a'],
                  bottom: ['#f4f0e6', '#c8c0b0', '#5a6a80', '#2a3a5a'], upper: 1, sleeve: 1, long: 1, thigh: 1, knee: 1, shin: 1,
                  shoes: ['gomusin'], accent: ['#c8302a', '#2a3a8a', '#6a3a8a', '#2a6a5a'],
                  paint: (P, of, T, B) => {
                      P[1] = of.accent; P[4] = '#fbfaf4'; P.d = T[1];
                      P.i = of.accent; P.I = shade(of.accent, 0.8);
                      P.K = of.bottom; P.b = B[0]; P.M = B[0];
                  },
                  back: r => { r[0] = '....o4444o....'; return r; },
                  pose: runs => { runs[0] = [11, 6, 'o444444o']; return runs; } },
        /* Russia: a kosovorotka — the collar opening off to one side,
           embroidered collar, placket, cuffs and hem, a sash; boots */
        kosovorotka: { w: 3, countries: ['russia'], body: 'kosov', top: ['#f4f0e6', '#c8302a', '#2a4a8a', '#e8d8a0'],
                  bottom: ['#26262c', '#2a3a5a', '#3a3a3a'], upper: 1, sleeve: 1, long: 1, thigh: 1, knee: 1, shin: 1,
                  shoes: ['boots'], boots: 1, hats: ['ushanka'], hatOdds: 0.35, hatCol: ['#6a4a30', '#7a7a80', '#2a2622'],
                  accent: ['#c8202a', '#1c1c22', '#2a6a3a'],
                  paint: (P, of) => {
                      const red = of.top === '#c8302a';
                      P[1] = red ? '#f0c040' : of.accent; P[2] = red ? '#1c1c22' : of.top === '#2a4a8a' ? '#f0c040' : '#1c1c22';
                      P[3] = red ? '#f0c040' : '#c8302a';
                  },
                  arm: rows => mapRows(rows, [8], r => put(r, 'o121o')),
                  back: r => { r[0] = '....o1111o....'; r[6] = '.o3333333333o.'; r[8] = '.o1212121212o.'; return r; },
                  pose: runs => { runs[0] = [11, 6, 'o111111o']; runs[4] = [15, 4, 'o3333333333o']; return runs; } },
        /* Ukraine: a vyshyvanka — white linen, an embroidered panel down
           the front and on the sleeves, a woven belt */
        vyshyvanka: { w: 3, countries: ['ukraine'], body: 'vysh', top: ['#f6f4ec', '#f6f4ec', '#ece6d4'],
                  bottom: ['#26262c', '#2a3a5a', '#2a3a8a', '#7a1a22'], upper: 1, sleeve: 1, long: 1, thigh: 1, knee: 1, shin: 1,
                  belt: 1, tuck: 1, shoes: ['boots'], boots: 1, accent: ['#c8202a', '#c8202a', '#1c1c22'],
                  paint: P => { P[1] = '#c8202a'; P[2] = '#1c1c22'; P.b = '#b8202a'; P.M = '#f0c040'; },
                  arm: (rows, pose) => mapRows(rows, pose ? [1, 2, 8] : [2, 3, 8], (r, i) => i === 8 ? put(r, 'o121o') : put(r, str(r).slice(0, 2) + (i === (pose ? 1 : 2) ? '12' : '21') + str(r).slice(4))),
                  back: r => { r[1] = '.ouu121212uuo.'; return r; } },
        /* Romania: a man's cămașă (ie) — white, black-and-red embroidery
           at the collar, chest and cuffs, a wide tooled belt, white trousers */
        camasa: { w: 3, countries: ['romania'], body: 'vysh', top: ['#f6f4ec'], bottom: ['#f0eee4', '#26262c'],
                  upper: 1, sleeve: 1, long: 1, thigh: 1, knee: 1, shin: 1, belt: 1, tuck: 1, shoes: ['boots'],
                  paint: P => { P[1] = '#1c1c22'; P[2] = '#b8202a'; P.b = '#5a3a20'; P.M = '#c8a050'; },
                  arm: rows => mapRows(rows, [7, 8], (r, i) => put(r, i === 8 ? 'o212o' : 'o111o')),
                  hipsF: ['obMbMbMbMbMo', 'opppppPppppo', 'opppppPpppPo', 'oppppppppppo'] },
        /* USA (Hawaiʻi): an aloha shirt, shorts, sandals, sometimes a lei */
        aloha:  { w: 3, countries: ['usa'], body: 'aloha', top: ['#2a6ab0', '#c8302a', '#1c7a6a', '#f0c040', '#f4f0e6', '#2a2a3a'],
                  bottom: ['#e8dcc0', '#f4f4f0', '#2a3a5a', '#c8b08a'], upper: 1, sleeve: 1, thigh: 1, pockets: 1,
                  shoes: ['sandals'], lei: 0.6,
                  paint: (P, of) => {
                      const warm = of.top === '#f0c040' || of.top === '#f4f0e6';
                      P[1] = warm ? '#e04a6a' : '#f4f0e6'; P[2] = warm ? '#2a8a4a' : '#f0c040';
                      P.X = shade(of.top, 0.7); P.d = shade(of.top, 0.8);
                      P[6] = '#ff7ab0'; P[7] = '#f8f0a0'; P[8] = '#3aa05a';
                  },
                  arm: (rows, pose) => mapRows(rows, [pose ? 1 : 2], r => put(r, pose ? 'ov1Vo' : 'ov1vV')),
                  back: r => { r[3] = 'oc1cccccc2ccCo'; r[5] = 'occc2ccc1cccCo'; r[7] = '.oc1ccc2cccCo.'; return r; },
                  pose: runs => { runs[2] = [13, 3, 'oc1cccCCc2ccCo']; runs[4] = [15, 4, 'occ2cCCc1cCo']; return runs; } },
        /* Spain: a traje corto — a short jacket, a white shirt buttoned to
           the neck, high-waisted trousers, a sombrero cordobés */
        trajecorto: { w: 3, countries: ['spain'], body: 'corto', top: ['#1c1c22', '#3a3e48', '#4a3a2a', '#6a6a72'],
                  bottom: ['#3a3a42', '#1c1c22', '#5a5a64'], upper: 1, sleeve: 1, long: 1, thigh: 1, knee: 1, shin: 1,
                  tuck: 1, shoes: ['boots'], hats: ['cordobes'], hatOdds: 0.6, hatCol: ['#1c1c22', '#3a3a42', '#4a3020'],
                  paint: (P, of, T, B) => {
                      P[4] = '#f4f4f0'; P[5] = '#d8d8e0'; P.X = B[1];
                      P.b = of.bottom; P.M = of.bottom;
                  },
                  arm: rows => mapRows(rows, [8], r => put(r, 'o444o')),
                  back: r => { r[5] = 'oppppppppppppo'; r[6] = '.oppppPppppPo.'; r[7] = '.oppppPppppPo.'; return r; },
                  pose: runs => { runs[3] = [14, 4, 'oppppppppppo']; runs[4] = [15, 4, 'oppppPPppppo']; runs[5] = [16, 5, 'oPPPPPPPPo']; return runs; } },
        /* Argentina / Uruguay: the gaucho — a shirt, a knotted pañuelo, a
           dark vest, the rastra belt with its coins, bombachas, boots, a boina */
        gaucho: { w: 3, countries: ['argentina', 'uruguay'], body: 'gaucho', top: ['#f4f4f0', '#c8dcf0', '#e8dcc0'],
                  bottom: ['#c8b08a', '#5a5a64', '#2a2a30', '#8a7a64'], upper: 1, sleeve: 1, long: 1, thigh: 1, knee: 1, shin: 1,
                  tuck: 1, shoes: ['boots'], boots: 1, hats: ['boina'], hatOdds: 0.6, hatCol: ['#1c1c22', '#2a3050', '#5a1a22'],
                  accent: ['#c8202a', '#2a4a9a', '#f4f4f0', '#1c1c22'],
                  paint: (P, of) => {
                      P[1] = of.accent === of.top ? '#c8202a' : of.accent; P[9] = '#2a2622';
                      P.b = '#3a2214'; P.M = '#d4d4dc'; P[3] = '#c0c0c8'; P.K = of.bottom;
                  },
                  hipsF: ['ob3b3MMb3b3o', 'opppppPppppo', 'opppppPpppPo', 'oppppppppppo'],
                  hipsB: ['ob3b3bb3b3bo', 'oppppDppppPo', 'oPpppDppppPo', 'oPpppDppppPo'],
                  back: r => r.map((s, i) => i >= 3 ? s.replace(/[cC]/g, '9') : s),
                  pose: runs => runs.map((r, i) => i >= 2 && i <= 5 ? put(r, str(r).replace(/[cC]/g, '9')) : r),
                  poseHips: runs => mapRows(runs, [0], r => put(r, 'ob3b33b3bo')) },
        /* Colombia: all white, a red pañuelo, a sombrero vueltiao */
        vueltiao: { w: 3, countries: ['colombia'], body: 'kerchief', top: ['#f6f6f2'], bottom: ['#f6f6f2', '#f0ece0'],
                  upper: 1, sleeve: 1, long: 1, thigh: 1, knee: 1, shin: 1, belt: 1, tuck: 1, shoes: ['sandals', 'loafers'],
                  hats: ['vueltiao'], hatOdds: 0.75, accent: ['#c8202a', '#c8202a', '#1c1c22'],
                  paint: (P, of) => { P[1] = of.accent; P.X = '#d8d8e0'; P.b = '#3a2a1a'; P.M = '#c8a850'; } },
        /* Venezuela / Colombia: a liqui liqui — a closed high collar, one
           row of buttons, four pockets, matching trousers */
        liqui:  { w: 2, countries: ['venezuela', 'colombia'], body: 'liqui', top: ['#f4f0e6', '#e8dcc0', '#d8c8a0', '#f6f6f2'],
                  bottom: 'same', upper: 1, sleeve: 1, long: 1, thigh: 1, knee: 1, shin: 1, shoes: ['loafers'],
                  hats: ['straw', 'cordobes'], hatOdds: 0.35, hatCol: ['#2a2622', '#4a3020'],
                  paint: (P, of, T) => { P.X = '#c8a040'; P.d = T[1]; P.K = of.bottom; } },
        /* the Caribbean and around: a guayabera (pleats, four pockets),
           light trousers, sometimes a straw hat */
        guayabera: { w: 3, countries: ['cuba', 'mexico', 'puertorico', 'dominicanrepublic', 'panama', 'venezuela', 'colombia', 'honduras'],
                  body: 'guaya', top: ['#f6f6f2', '#f6f6f2', '#ece0c4', '#c8dcf0', '#e8d0d0'],
                  bottom: ['#ece0c4', '#c8b08a', '#2a2a30', '#f6f6f2'], upper: 1, sleeve: 1, thigh: 1, knee: 1, shin: 1,
                  shoes: ['loafers'], hats: ['straw'], hatOdds: 0.4,
                  paint: (P, of, T) => { P.d = T[0]; P.X = '#c8c4b8'; P.K = of.bottom; },
                  back: r => r.map((s, i) => i >= 3 ? s.slice(0, 3) + 'd' + s.slice(4, 10) + 'd' + s.slice(11) : s) },
        /* UK: a sharp mod suit — slim lapels, a narrow tie, Chelsea boots */
        mod:    { w: 3, countries: ['uk'], body: 'suit', top: ['#3a3e48', '#1c1c22', '#2a3450', '#6a6a72', '#4a5a4a'],
                  bottom: 'same', upper: 1, sleeve: 1, long: 1, thigh: 1, knee: 1, shin: 1, shoes: ['boots', 'loafers'],
                  accent: ['#1c1c22', '#7a1a22', '#2a3a6a'],
                  paint: (P, of, T) => { P[4] = '#f4f4f0'; P[1] = of.accent === of.top ? '#7a1a22' : of.accent; P.d = T[1]; P.X = T[1]; P.K = of.top; },
                  arm: rows => mapRows(rows, [8], r => put(r, 'o444o')) },
        /* Brazil: the samba malandro — a white suit over a striped shirt,
           two-tone shoes, a straw hat */
        malandro: { w: 3, countries: ['brazil'], body: 'malandro', top: ['#f6f6f2'], bottom: 'same',
                  upper: 1, sleeve: 1, long: 1, thigh: 1, knee: 1, shin: 1, shoes: ['twotone'], hats: ['straw'], hatOdds: 0.7,
                  accent: ['#c8202a', '#1c2a5a'],
                  paint: (P, of, T) => { P[1] = of.accent; P[4] = '#f6f6f2'; P.d = T[0]; P.X = T[1]; P.K = of.top; } },
        /* Iceland (lopapeysa), Sweden, Finland: a knit with a patterned yoke */
        knit:   { w: 3, countries: ['iceland', 'sweden', 'finland'], body: 'knit', top: ['#e8e0d0', '#5a5a62', '#2a2a30', '#8a6a4a', '#2a3a5a'],
                  bottom: ['#2a2a30', '#3b5b8c', '#4a4a50'], upper: 1, sleeve: 1, long: 1, thigh: 1, knee: 1, shin: 1,
                  pockets: 1, shoes: ['boots'],
                  paint: (P, of) => {
                      const light = of.top === '#e8e0d0';
                      P[1] = light ? '#3a3a42' : '#e8e0d0'; P[2] = light ? '#8a6a4a' : of.top === '#2a3a5a' ? '#c8302a' : '#a8a8b0';
                  },
                  arm: (rows, pose) => pose ? mapRows(rows, [0, 1, 8], (r, i) => put(r, i === 0 ? 'o12o' : 'o111o'))
                                         : mapRows(rows, [0, 1, 2, 8], (r, i) => put(r, i === 0 ? '.oo11' : i === 1 ? 'o1212' : 'o111o')),
                  back: r => { r[1] = '.o1111111111o.'; r[2] = 'o121212121212o'; r[3] = 'o111111111111o'; r[7] = '.o1212121212o.'; r[8] = '.o1111111111o.'; return r; },
                  pose: runs => { runs[1] = [12, 3, 'o121212121212o']; runs[2] = [13, 3, 'o111111111111o']; return runs; } },
        /* France: a marinière (navy stripes, boat neck) */
        breton: { w: 2, countries: ['france'], body: 'breton', top: ['#f6f6f2'], bottom: ['#1c2a5a', '#2a2a30', '#e8dcc0'],
                  upper: 1, sleeve: 1, long: 1, thigh: 1, knee: 1, shin: 1, belt: 1, pockets: 1, shoes: ['sneakers', 'loafers'],
                  accent: ['#1c2a5a', '#1c2a5a', '#c8202a'],
                  paint: (P, of) => { P[1] = of.accent; },
                  arm: rows => mapRows(rows, [1, 3, 5, 7], r => fill(r, '1')),
                  back: r => mapRows(r, [2, 4, 6, 8], s => fill(s, '1')),
                  pose: runs => mapRows(runs, [1, 3, 5], r => fill(r, '1')) },
    };
    /* a national outfit's chest / back can also replace the head's hair with
       a hat: HATWEAR[kind] = { cols, from (the first hair row still drawn,
       hair row 0 = y -2), front [[y, x, run]], back (default front) } in
       the front's coordinates; the bent-over pose draws back 3 rows lower */
    const HATWEAR = {
        /* the charro's sombrero: tall crown, an embroidered band, a wide
           brim turned up at the tips */
        sombrero: { cols: null, from: 5, front: [
            [-5, 8, 'oooo'],
            [-4, 7, 'oqqqqo'],
            [-3, 6, 'oqqQqqqo'],
            [-2, 6, 'oqqqqqQo'],
            [-1, -2, 'oo'], [-1, 6, 'oyyyyyyo'], [-1, 20, 'oo'],
            [0, -2, 'oqo'], [0, 5, 'oqqqqqqqqo'], [0, 19, 'oqo'],
            [1, -2, 'oqqoooooqqqqqqqqoooooqqo'],
            [2, -1, 'oqyqqyqqyqqyyqqyqqyqqyqo'.slice(0, 22)],
            [3, 0, 'oooooooooooooooooooo'],
        ] },
        /* a fur ushanka with the flaps down */
        ushanka: { cols: ['#6a4a30', '#7a7a80', '#2a2622'], from: 99, front: [
            [-3, 5, 'oooooooooo'],
            [-2, 4, 'oqqqqqqqqqqo'],
            [-1, 4, 'oqqqQqqqQqqo'],
            [0, 3, 'oQQQQQQQQQQQQo'],
            [1, 3, 'oQyQyQyQyQyQQo'],
            [2, 3, 'oQQQQQQQQQQQQo'],
            [3, 3, 'oqqo'], [3, 13, 'oqqo'],
            [4, 2, 'oqqqo'], [4, 13, 'oqqqo'],
            [5, 2, 'oqqqo'], [5, 13, 'oqqqo'],
            [6, 2, 'oQQQo'], [6, 13, 'oQQQo'],
            [7, 3, 'ooo'], [7, 14, 'ooo'],
        ] },
        /* the flat-crowned, flat-brimmed sombrero cordobés */
        cordobes: { cols: null, from: 5, front: [
            [-3, 6, 'oooooooo'],
            [-2, 6, 'oqqqqqQo'],
            [-1, 6, 'oqqqqqQo'],
            [0, 6, 'oyyyyyyo'],
            [1, 0, 'oqqqqqqqqqqqqqqqqqqo'],
            [2, 1, 'oooooooooooooooooo'],
        ] },
        /* the gaucho's boina, worn flat and a little to one side */
        boina: { cols: null, from: 5, front: [
            [-2, 10, 'oo'],
            [-1, 4, 'oooooooooooo'],
            [0, 3, 'oqqqqqqqqqqqqo'],
            [1, 3, 'oqqqqqqqqqqqQo'],
            [2, 4, 'oooooooooooo'],
        ] },
        /* Colombia's sombrero vueltiao: woven cream and black bands */
        vueltiao: { cols: ['#ece0c0'], from: 5, front: [
            [-4, 8, 'oooo'],
            [-3, 7, 'oqqqqo'],
            [-2, 6, 'oQQQQQQo'],
            [-1, 6, 'oqqqqqqo'],
            [0, 6, 'oQQQQQQo'],
            [1, 0, 'oqqQqqQqqQQqqQqqQqqo'],
            [2, 0, 'oQQQQQQQQQQQQQQQQQQo'],
            [3, 1, 'oooooooooooooooooo'],
        ] },
        /* a straw hat with a dark band (Panama, pava, the malandro's) */
        straw: { cols: ['#e8d8a0', '#f0e4b8'], from: 5, front: [
            [-3, 7, 'oooooo'],
            [-2, 6, 'oqqQQqqo'],
            [-1, 6, 'oqqqqqqo'],
            [0, 6, 'oyyyyyyo'],
            [1, 2, 'oqqqqqqqqqqqqqqo'],
            [2, 3, 'oooooooooooooo'],
        ] },
        /* a hachimaki tied round the forehead, the knot at the side */
        hachimaki: { cols: null, from: 0, front: [
            [2, 16, 'qq'],
            [3, 4, 'qqqqqqqqqqqqqQq'],
            [4, 16, 'Qq'],
        ], back: [
            [3, 4, 'qqqqqqqqqqqq'],
            [4, 9, 'QQ'], [5, 8, 'q..q'],
        ] },
    };
    const SHOES = {
        sneakers: { n: '#f4f4f8', g: '#b0b0bc' },
        hightops: { n: '#1c1c22', N: '#f4f4f8', g: '#e8e8f0' },
        loafers:  { n: '#6a3a1e', N: '#4a2814', g: '#2a1810' },
        boots:    { n: '#1e1a18', N: '#34302c', g: '#0c0a0a' },
        twotone:  { n: '#f4f4f0', N: '#1c1c22', g: '#2a2a30' },
        gomusin:  { n: '#f4f4f0', N: '#d8d8e0', g: '#b8b8c4' },
        tabi:     { n: '#26262c', N: '#3a3a42', g: '#141418' },
        geta:     null,   /* a bare foot on a wooden sole, a strap */
        sandals:  null,   /* bare feet on a sole, a strap */
        bare:     null,
    };
    const ACCENTS = ['#e0304a', '#2f6fd6', '#3ac060', '#f0a020', '#1c1c22', '#7a4fd0'];

    function pickOutfit(not, ctx) {
        const name = K.pickOutfitName(not, OUTFITS, ctx && ctx.country), o = OUTFITS[name], top = pick(o.top);
        const of = { name: name, top: top, bottom: o.bottom === 'same' ? top : pick(o.bottom), shoes: pick(o.shoes),
                     accent: pick(o.accent || ACCENTS), print: Math.random() < (o.print || 0) };
        if (o.hats && Math.random() < (o.hatOdds == null ? 0.5 : o.hatOdds)) {
            of.hat = pick(o.hats);
            const cols = o.hatCol || HATWEAR[of.hat].cols;
            of.hatCol = cols ? pick(cols) : top;
        }
        if (o.lei && Math.random() < o.lei) of.lei = true;
        return of;
    }
    function variant(ctx) {
        const skin = pick(Object.keys(SKINS));
        const r = Math.random();
        return {
            skin: skin, eyes: pick(EYES), hair: pick(STYLES),
            colour: Math.random() < 0.08 ? pick(HAIR_RARE) : pick(HAIR),
            beard: r < 0.5 ? 'none' : r < 0.75 ? 'stubble' : r < 0.9 ? 'beard' : 'goatee',
            hat: pick(HATS), shades: Math.random() < 0.15,
            outfit: pickOutfit(null, ctx), face: 'smile',
        };
    }
    /* the same man in other clothes */
    function restyle(v, ctx) {
        v = v || variant(ctx);
        return Object.assign({}, v, { outfit: pickOutfit(v.outfit && v.outfit.name, ctx) });
    }

    /* ── His palette ───────────────────────────────────────────── */
    function palette(v) {
        const sk = SKINS[v.skin] || SKINS.peach;
        const of = v.outfit || { name: 'tee', top: '#f4f4f8', bottom: '#3b5b8c', shoes: 'sneakers', accent: '#e0304a' };
        const o = OUTFITS[of.name] || OUTFITS.tee;
        const hair = v.colour || '#2a1a12';
        const P = { o: sk.o, s: sk.s, S: sk.S, e: v.eyes || '#3a2216', m: mix(sk.S, '#8a2a2a', 0.3),
                    h: hair, H: shade(hair, hair === '#141010' ? 1.35 : 0.72),
                    k: '#f8f4ec', O: mix(sk.o, '#8a2a2a', 0.45) };
        /* dyed (matrix-green) hair: brows and beard stay a natural dark brown,
           or the beard rings his face like a neon helmet */
        const facial = hair === '#3ac060' ? '#3a2416' : hair;
        P.B = shade(facial, 0.8);
        P.f = mix(hair, sk.s, 0.45);
        P.E = { fade: P.f, buzz: P.f, cap: P.f }[v.hair] || hair;
        const beard = v.beard || 'none';
        const stub = mix(sk.s, facial, 0.4);
        P.z = beard === 'beard' ? facial : beard === 'stubble' ? stub : sk.s;
        P.Z = beard === 'beard' || beard === 'goatee' ? facial : beard === 'stubble' ? stub : sk.s;
        P.G = '#0c0c10'; P.Y = '#5a6a7a';
        P.q = v.hat || '#26262c'; P.Q = shade(P.q, P.q === '#26262c' ? 1.4 : 0.72);

        const top = of.top, bot = of.bottom;
        const T = K.clothShades(top), B = K.clothShades(bot);
        const skin = (a, b) => { P[a] = sk.s; P[b] = sk.S; };
        const cloth = (on, a, b, c1, c2) => { if (on) { P[a] = c1; P[b] = c2; } else skin(a, b); };
        P.c = top; P.C = T[0]; P.x = T[1];
        if (o.body === 'bare') { P.c = sk.s; P.C = sk.S; P.x = sk.S; }
        cloth(o.upper, 'u', 'U', top, T[0]);
        cloth(o.sleeve, 'v', 'V', top, T[0]);
        cloth(o.long, 'w', 'W', top, T[0]);
        P.d = { tee: T[0], tank: top, hoodie: '#f4f4f8', shirt: T[1], track: T[1], agent: T[0], bare: sk.S }[o.body] || T[0];
        P.X = { tee: of.accent, shirt: T[1], track: '#c8c8d0', agent: '#3ac060' }[o.body] || T[1];
        if (o.body === 'tee' && !of.print) P.X = top;
        P.r = o.stripe ? of.accent : P.v;
        P.p = bot; P.P = B[0]; P.K = B[1];
        if (!o.pockets) P.K = bot;
        P.L = shade(bot, 1.15);
        P.D = B[0];
        P.b = o.belt ? (o.body === 'agent' ? '#0c0a0a' : '#4a2a18') : B[0];
        P.M = o.belt ? (o.body === 'agent' ? '#8a8a94' : '#c8a850') : B[0];
        cloth(o.thigh, 'a', 'A', bot, B[0]);
        cloth(o.knee, 't', 'T', bot, B[0]);
        cloth(o.shin, 'j', 'J', bot, B[0]);
        P.R = o.stripe ? of.accent : P.a;
        const sh = SHOES[of.shoes];
        if (sh) {
            P.n = sh.n; P.N = sh.N || of.accent; P.g = sh.g;
            /* ankle: the cuff of long trousers, else a white sock */
            if (o.shin) { P.i = o.cuff ? B[0] : bot; P.I = B[0]; }
            else { P.i = '#f4f4f8'; P.I = '#d0d0da'; }
            /* high boots: the shins in boot leather */
            if (o.boots) { P.j = P.i = sh.n; P.J = P.I = sh.N || sh.n; }
        } else {
            /* sandals / geta: bare foot on a sole with a strap; bare: just feet */
            const strap = of.shoes === 'geta' ? '#2a2a30' : of.accent;
            const sole = of.shoes === 'geta' ? '#a87a4a' : of.shoes === 'sandals' ? '#3a3a42' : sk.S;
            P.n = sk.s; P.N = of.shoes === 'bare' ? sk.S : strap; P.g = sole;
            P.i = sk.s; P.I = sk.S;
            if (o.shin && of.shoes !== 'geta') { P.i = bot; P.I = B[0]; }
        }
        /* the national outfit's own letters, and its hat */
        P.y = '#1c1c22';
        if (o.paint) o.paint(P, of, T, B, sk);
        if (of.hat) {
            P.q = of.hatCol || top;
            P.Q = of.hat === 'vueltiao' ? '#1c1a18' : shade(P.q, K.clothShades(P.q)[0] === shade(P.q, 1.12) ? 1.35 : 0.78);
            if (of.hat === 'straw') { P.Q = '#c8b478'; P.y = '#2a2a30'; }
            if (of.hat === 'hachimaki' && P.q === '#f4f4f0') P.Q = '#c8302a';
            if (of.hat === 'boina' || of.hat === 'cordobes') P.y = shade(P.q, 1.4);
            if (of.hat === 'ushanka') P.y = shade(P.q, 0.8);
        }
        return P;
    }

    /* ── Front ─────────────────────────────────────────────────── */
    /* the face, 10 wide at x 5–14, y 1–10: brows, eyes, nose, mouth, a
       square jaw (z / Z: where a beard grows) */
    const FACE = [
        "..oooooo..",
        ".osssssso.",
        "osssssssso",
        "osBBssBBso",
        "osesssseso",
        "osssssssSo",
        "ozsssSsszo",
        "ozzsmmszzo",
        ".ozzZZzzo.",
        "..oooooo..",
    ];
    const SHADES_ROWS = ["oGYGGGYGGo", "osGGssGGSo"];   /* y5, y6 */
    /* His expressions (positive only): rows of FACE swapped by v.face.
       k = teeth, O = an open mouth; the beard (z Z) keeps framing it.
       Closed happy eyes are ^ ^ slants in the outline colour (no brows).
       cool puts the shades on and smirks. */
    const FACES = ['smile', 'grin', 'joy', 'wink', 'sing', 'laugh', 'cool'];
    const FACE_ROWS = {
        smile: {},
        grin:  { 6: "ozmssSsmzo", 7: "ozzkkkkzzo" },
        joy:   { 3: "ossossosso", 4: "osossssoso", 6: "ozmssSsmzo", 7: "ozzkkkkzzo" },
        wink:  { 3: "osBBssssso", 4: "osessBBBso", 6: "ozsssSsmzo", 7: "ozzsmmmzzo" },
        sing:  { 6: "ozmssSsmzo", 7: "ozzmOOmzzo", 8: ".ozzOOzzo." },
        laugh: { 3: "ossossosso", 4: "osossssoso", 6: "ozmkkkkmzo", 7: "ozzOOOOzzo" },
        cool:  { 6: "ozsssSsmzo", 7: "ozzsmmmzzo" },
    };
    function faceRows(face, shades) {
        const swap = FACE_ROWS[face] || FACE_ROWS.smile;
        const rows = FACE.map((r, i) => swap[i] || r);
        /* shades: the brows and eyes as usual, the lenses over them */
        if (shades || face === 'cool') { rows[2] = FACE[2]; rows[3] = FACE[3]; rows[4] = SHADES_ROWS[0]; rows[5] = SHADES_ROWS[1]; }
        return rows;
    }

    /* hair over the head, 16 wide at x 2–17, row 0 = y -2 */
    function hairFront(style) {
        const R = {};
        switch (style) {
            case 'crop':
                R[1] = "......hhhh......";
                R[2] = "....hhhhhhhh....";
                R[3] = "...hhhHhhhhhh...";
                R[4] = "...hhhhhhhHhh...";
                R[5] = "...hh......hh...";
                R[6] = "...h........h...";
                R[7] = "...h........h...";
                break;
            case 'fade':
                R[1] = "......hhhh......";
                R[2] = "....hhHhhhhh....";
                R[3] = "...hhhhhhhHhh...";
                R[4] = "...fhhhhhhHhf...";
                R[5] = "...f........f...";
                R[6] = "...f........f...";
                break;
            case 'buzz':
                R[2] = "....fhhhhhhf....";
                R[3] = "...ffffffffff...";
                R[4] = "...ffffffffff...";
                R[5] = "...f........f...";
                break;
            case 'curly':
                R[0] = "....hHh.hHh.....";
                R[1] = "...hhhhHhhhhH...";
                R[2] = "...hHhhhhHhhhh..";
                R[3] = "...hhhHhhhhhHh..";
                R[4] = "...fhhhhHhhhhf..";
                R[5] = "...f........f...";
                R[6] = "...f........f...";
                break;
            case 'bun':
                R[0] = "......hHHh......";
                R[1] = ".......XX.......";
                R[2] = "....hhHHHHhh....";
                R[3] = "...hhHhhhhHhh...";
                R[4] = "...hhhhhhhhhh...";
                R[5] = "...h........h...";
                R[6] = "...h........h...";
                break;
            case 'slick':
                R[1] = ".....hhhhhh.....";
                R[2] = "....hHHHHHhh....";
                R[3] = "...hhhhhhhHHh...";
                R[4] = "...hhhhhhhhhh...";
                R[5] = "...h........h...";
                R[6] = "...f........f...";
                break;
            case 'cap':
                R[1] = ".....qqqqqq.....";
                R[2] = "....qqqqqqqq....";
                R[3] = "...qqqqXXqqqq...";
                R[4] = "..QQQQQQQQQQQQ..";
                R[5] = "...f........f...";
                R[6] = "...f........f...";
                break;
            case 'beanie':
                R[0] = "......qqqq......";
                R[1] = ".....qqqqqqq....";
                R[2] = "....qqqqqqqqq...";
                R[3] = "...qqqqqqqqqq...";
                R[4] = "...QqQqQqQqQq...";
                R[5] = "...QQQQQQQQQQ...";
                R[6] = "...h........h...";
                break;
        }
        return K.rowsAt(R, 8);
    }
    /* hair from behind (over the filled back of the head) */
    function hairBack(style) {
        const F = hairFront(style), R = {};
        for (let i = 0; i <= 4; i++) R[i] = F[i];
        if (style === 'cap') { R[4] = "...qqqqqqqqqq..."; R[5] = "...QQQQ..QQQQ..."; }
        if (style === 'beanie') R[5] = F[5];
        return K.rowsAt(R, 8);
    }
    /* under a national hat a cap / beanie is just short hair */
    const hatHair = style => (style === 'cap' || style === 'beanie') ? 'buzz' : style;
    /* the hair rows from `from` on (the rest is under the hat) */
    const below = (rows, from) => rows.map((r, i) => i < from ? '................' : r);
    function hatRuns(of, view, dy) {
        const h = of && of.hat && HATWEAR[of.hat];
        if (!h) return null;
        const runs = (view !== 'front' && h.back) || h.front;
        return runs.map(r => [r[0] + (dy || 0), r[1], r[2]]);
    }

    /* the torso, 14 wide at x 3–16, y 9–17, per outfit body */
    const CHEST = {
        tee: [
            "....oSssSo....",
            ".oouuddddduoo.",
            "ouuuuudduuuuUo",
            "occcccccccccCo",
            "occcccXXccccCo",
            "ocCCccXXcCCcCo",
            ".occcccccccCo.",
            ".occcccccccCo.",
            ".oCCCCCCCCCCo.",
        ],
        tank: [
            "....oSssSo....",
            ".oucsssssscuo.",
            "ouucsssssscuUo",
            "ouuccssssccuUo",
            "ouucccccccccUo",
            "ocCCccccCCccCo",
            ".occcccccccCo.",
            ".occcccccccCo.",
            ".oCCCCCCCCCCo.",
        ],
        hoodie: [
            "...oCSssSCo...",
            ".occCCssCCcco.",
            "occccCCCCcccCo",
            "occccdccdcccCo",
            "occccdccdcccCo",
            "occcCCCCCCccCo",
            ".occCccccCcCo.",
            ".oCCCCCCCCCCo.",
            ".oCxCxCxCxCCo.",
        ],
        shirt: [
            "....oSssSo....",
            ".occddssddcco.",
            "occccdssdcccCo",
            "occcccdXccccCo",
            "occcccccdcccCo",
            "ocCCcccXcCCcCo",
            ".occccccdccCo.",
            ".occcccXcccCo.",
            ".oCCCCCCdCCCo.",
        ],
        track: [
            "....oCcXCo....",
            ".occccCXcccco.",
            "occccccXccccCo",
            "orrrrrrXrrrrro",
            "occccccXccccCo",
            "ocCCcccXcCCcCo",
            ".occcccXcccCo.",
            ".occcccXcccCo.",
            ".oCCCCCXCCCCo.",
        ],
        bare: [
            "....oSssSo....",
            ".osssssssssso.",
            "osssssssssssSo",
            "ossssssssssSSo",
            "osSSSSssSSSSSo",
            "ossssSssSsssSo",
            ".ossSssSssSSo.",
            ".ossSssSssSSo.",
            ".osssssSsssSo.",
        ],
        agent: [
            "....oCCCCo....",
            ".occcCCCCccco.",
            "occcccCCcccCCo",
            "occcccdccccCCo",
            "occcccdcccccCo",
            "ocCCccdcCCccCo",
            ".occccdccccCo.",
            ".occccdccccCo.",
            ".oCCCCdCCCCCo.",
        ],
        /* the charro's jacket: open over a white shirt, the moño at the
           collar, the botonadura down the jacket's edges */
        charro: [
            "....o4ss4o....",
            ".occc4ss4ccco.",
            "occ31122113cCo",
            "occ31444413cCo",
            "occc344443ccCo",
            "occcc3443cccCo",
            ".occcc33cccCo.",
            ".occcc3ccccCo.",
            ".oCCCCCCCCCCo.",
        ],
        /* the yukata: the collar a "y" (left over right), a sparse print */
        yukata: [
            "....oSssSo....",
            ".occdssssdcco.",
            "occccdssdcccCo",
            "occcccddcccXCo",
            "ocXccdccccccCo",
            "occcdccccXccCo",
            ".ocdcccccccCo.",
            ".odcccXccccCo.",
            ".oCdCCCCCCCCo.",
        ],
        /* the happi: collar bands down both edges, a dark haragake under,
           a sash at the waist */
        happi: [
            "....oSssSo....",
            ".occcdssdccco.",
            "occcd4444dccCo",
            "occcd4444dccCo",
            "occcd4444dccCo",
            "ocCCd4444dCCCo",
            ".o1111111111o.",
            ".occd4444dcCo.",
            ".oCCd4444dCCo.",
        ],
        /* the jeogori: a white collar band crossing over, the ribbon tie */
        hanbok: [
            "....o4ss4o....",
            ".occ4ssss4cco.",
            "occcccc4dcccCo",
            "occccc4dccccCo",
            "occcc4dcccccCo",
            "occc11dccccCCo",
            ".occ11cccccCo.",
            ".occ11cccccCo.",
            ".oCC1C1CCCCCo.",
        ],
        /* the kosovorotka: embroidered collar, the side placket, the
           sash with its tassel, an embroidered hem */
        kosov: [
            "....o1111o....",
            ".occcccccccco.",
            "occc121212ccCo",
            "occcccccd1ccCo",
            "occcccccd1ccCo",
            "ocCCccccc1CcCo",
            ".o3333333333o.",
            ".o3cccccccCCo.",
            ".o1212121212o.",
        ],
        /* the vyshyvanka / cămașă: an embroidered panel down the front */
        vysh: [
            "....o1ss1o....",
            ".occ12ss21cco.",
            "occc1c22c1ccCo",
            "occcc1221cccCo",
            "occc1c22c1ccCo",
            "occcc1221cccCo",
            ".occ1c22c1cCo.",
            ".occccccccCCo.",
            ".oCCCCCCCCCCo.",
        ],
        /* the aloha shirt: camp collar, buttons, hibiscus + leaves */
        aloha: [
            "....oSssSo....",
            ".occcdssdccco.",
            "oc11cccXcc2cCo",
            "occ1cccXc11cCo",
            "oc2ccccXcc1cCo",
            "occcc11Xc2cCCo",
            ".o1ccccXcc1Co.",
            ".occ2ccX11cCo.",
            ".oCCCCCXCC2Co.",
        ],
        /* the traje corto: a short jacket, a white shirt buttoned to the
           neck, high-waisted trousers from the ribs down */
        corto: [
            "....o4SS4o....",
            ".occd4444dcco.",
            "occcd4444dccCo",
            "occcd4554dccCo",
            "oCCCCd44dCCCCo",
            "oppppppppppppo",
            ".oppppXppppPo.",
            ".opppppppppPo.",
            ".oPPPPPPPPPPo.",
        ],
        /* the gaucho: a shirt, the pañuelo knotted at the throat, a vest */
        gaucho: [
            "....oSssSo....",
            ".o99cccccc99o.",
            "o999c1111c999o",
            "o999cc11cc999o",
            "o9999cccc9999o",
            "o9999cXcc9999o",
            ".o9999cc9999o.",
            ".o9999cc9999o.",
            ".o9999999999o.",
        ],
        /* a white shirt with a knotted kerchief */
        kerchief: [
            "....oSssSo....",
            ".occcccccccco.",
            "occcc1111cccCo",
            "occccc11ccccCo",
            "occcccdXccccCo",
            "ocCCcccccCCcCo",
            ".occccccdccCo.",
            ".occcccXcccCo.",
            ".oCCCCCCdCCCo.",
        ],
        /* the liqui liqui: closed high collar, one row of buttons, pockets */
        liqui: [
            "....oddddo....",
            ".occccdddccco.",
            "occcddddddccCo",
            "occddcXcddccCo",
            "occcccXcccccCo",
            "ocCCccXccCCcCo",
            ".ocddcXcddcCo.",
            ".occcccccccCo.",
            ".oCCCCXCCCCCo.",
        ],
        /* the guayabera: pleats, a placket, four pockets, worn out */
        guaya: [
            "....oSssSo....",
            ".occcdssdccco.",
            "occdcccXccdcCo",
            "occdddcXdddcCo",
            "occdcccXccdcCo",
            "occdcccXccdcCo",
            ".ocdddcXdddCo.",
            ".ocdcccXcdcCo.",
            ".oCdCCCXCdCCo.",
        ],
        /* the mod suit: slim lapels, a white shirt, a narrow tie */
        suit: [
            "....o4SS4o....",
            ".occcccccccco.",
            "occcd4114dccCo",
            "occccd11dcccCo",
            "occcccddccccCo",
            "ocCCccXccCCcCo",
            ".occccXccccCo.",
            ".occcccccccCo.",
            ".oCCCCCCCCCCo.",
        ],
        /* the malandro: a white suit open over a striped shirt */
        malandro: [
            "....oSssSo....",
            ".occcccccccco.",
            "occcd1111dccCo",
            "occccd44dcccCo",
            "occccc11ccccCo",
            "ocCCccXccCCcCo",
            ".occccXccccCo.",
            ".occcccccccCo.",
            ".oCCCCCCCCCCo.",
        ],
        /* the knit: a patterned yoke, dots, a patterned hem */
        knit: [
            "....o1111o....",
            ".o1111111111o.",
            "o121212121212o",
            "o111111111111o",
            "occ2ccc2ccc2Co",
            "occcccccccccCo",
            ".occcccccccCo.",
            ".o1212121212o.",
            ".o1111111111o.",
        ],
        /* the marinière: a boat neck, navy stripes */
        breton: [
            "....oSssSo....",
            ".occsssssscco.",
            "o111111111111o",
            "occcccccccccCo",
            "o111111111111o",
            "occcccccccccCo",
            ".o1111111111o.",
            ".occcccccccCo.",
            ".o1111111111o.",
        ],
    };
    /* from behind: a plain back, the spine in shade */
    const BACK = {
        base: [
            "....osssso....",
            ".ouuuuuuuuuuo.",
            "ouuuuuuuuuuuUo",
            "occcccCcccccCo",
            "occcccCcccccCo",
            "occcccCcccccCo",
            ".occccCccccCo.",
            ".occccCccccCo.",
            ".oCCCCCCCCCCo.",
        ],
    };
    function backChest(body, o) {
        let r = BACK.base.slice();
        if (body === 'hoodie') { r[0] = "...oCCCCCCo..."; r[1] = ".occCcccccCco."; r[2] = "occccCCCCcccCo"; r[3] = "occccCccCcccCo"; r[4] = "occcccCCccccCo"; }
        if (body === 'track') { r[0] = "....oCCCCo...."; r[4] = "orrrrrrrrrrrro"; }
        if (body === 'agent' || body === 'liqui') r[0] = "....oCCCCo....";
        if (body === 'tank') { r[1] = ".oucsssssscuo."; r[2] = "ouucsSssSscuUo"; r[3] = "ouuccSssSccuUo"; }
        if (body === 'bare') { r[1] = ".osssssssssso."; r[2] = "ossSSsssSSssSo"; r[3] = "osssSsSsSssSSo"; r[4] = "osssssSsssssSo"; }
        if (body === 'gaucho' || body === 'kerchief') r[0] = "....o1111o....";
        if (body === 'charro' || body === 'corto' || body === 'suit') r[0] = "....o4444o....";
        if (o && o.back) r = o.back(r);
        return r;
    }
    /* the hips, 12 wide at x 4–15, y 17–20 */
    const HIPS_FRONT = ["obbbbbMbbbbo", "opppppPppppo", "opppppPpppPo", "oppppppppppo"];
    const HIPS_BACK = ["obbbbbbbbbbo", "opKKKppKKKpo", "opKKKDpKKKpo", "oPpppDppppPo"];
    /* an arm hanging from the shoulder, 5 wide (the left at x 0–4) */
    const ARM = [
        ".oouu",
        "ouuuu",
        "ovvvV",
        "oVVVo",
        "owwWo",
        "owwWo",
        "owwWo",
        "owwWo",
        "oWWWo",
        "ossSo",
        ".ooo.",
    ];
    /* a leg (the left at x 4–9, y 20–29): thigh, knee, shin, ankle, shoe;
       the shins keep to the inside (x 5–9) so the legs meet like lola's,
       with no see-through gap between them */
    const LEG = [
        "oaaaaA",
        "oaaaaA",
        "otttTo",
        ".ottTo",
        ".ojjJo",
        ".ojjJo",
        ".ojjJo",
        ".oiiIo",
        "onNnno",
        "oggggo",
    ];
    const TUCKED = { shirt: 1, agent: 1, bare: 1 };
    const mirrorRow = r => r.split('').reverse().join('');

    function stripeArm(rows) { return rows.map((r, i) => i >= 2 && i <= 8 ? r[0] + 'r' + r.slice(2) : r); }
    function stripeLeg(rows) { return rows.map((r, i) => i <= 7 ? r.replace(/o[a-zA-Z]/, 'oR') : r); }

    /* the lei: flowers round the neck, front / back / bent over */
    const LEI_FRONT = [[10, 4, '67'], [10, 14, '76'], [11, 5, '8'], [11, 14, '8'], [11, 6, '7'], [11, 13, '6'],
                       [12, 7, '6'], [12, 12, '7'], [13, 8, '7686']];
    const LEI_BACK = [[10, 4, '676867686767']];
    const LEI_POSE = [[12, 5, '6768676867']];

    function head(view, v, col) {
        const of = v.outfit || {};
        const hat = hatRuns(of, view === 'front' ? 'front' : 'back', 0);
        const style = hat ? hatHair(v.hair) : v.hair;
        const from = hat ? HATWEAR[of.hat].from : 0;
        const ears = [[5, 4, 's'], [6, 4, 'S'], [5, 15, 's'], [6, 15, 'S'], [5, 3, 'o'], [6, 3, 'o'], [5, 16, 'o'], [6, 16, 'o'], [7, 4, 'o'], [7, 15, 'o']];
        if (view === 'front') {
            const face = faceRows(v.face, v.shades);
            return K.spec(ears, col) + K.pix(face, 5, 1, col) + K.pix(below(hairFront(style), from), 2, -2, col) +
                   (hat ? K.spec(hat, col) : '');
        }
        /* from behind: the head's shape in hair, the lower edge E, the nape */
        let back = [
            "..oooooo..",
            ".ohhhhhho.",
            "ohhhhhhhho",
            "ohhhhhhhho",
            "ohhhHhhhho",
            "ohhhhhhhho",
            "ohhhhhhhHo",
            "oEEEEEEEEo",
            ".osssssso.",
            "..oooooo..",
        ];
        if (style === 'buzz' || style === 'cap') back = back.map(r => r.replace(/[hH]/g, 'f'));
        return K.spec(ears, col) + K.pix(back, 5, 1, col) + K.pix(below(hairBack(style), from), 2, -2, col) +
               (hat ? K.spec(hat, col) : '');
    }

    function parts(view, v) {
        v = v || variant();
        const P = palette(v), col = ch => P[ch];
        const of = v.outfit || {};
        const o = OUTFITS[of.name] || OUTFITS.tee;
        const front = view === 'front';
        let arm = ARM.slice(), leg = LEG.slice();
        if (o.stripe) { arm = stripeArm(arm); leg = stripeLeg(leg); }
        if (o.arm) arm = o.arm(arm, false);
        if (o.leg) leg = o.leg(leg, false);
        const tucked = o.tuck || TUCKED[o.body];
        let chest = K.pix((front ? CHEST[o.body] : backChest(o.body, o)).slice(0, tucked ? 8 : 9), 3, 9, col);
        if (of.lei) chest += K.spec(front ? LEI_FRONT : LEI_BACK, col);
        return {
            legL: K.pix(leg, 4, 20, col),
            legR: K.pix(leg.map(mirrorRow), 10, 20, col),
            hips: K.pix(front ? (o.hipsF || HIPS_FRONT) : (o.hipsB || HIPS_BACK), 4, 17, col),
            /* a tucked shirt, the agent's and bare skin show the belt */
            chest: chest,
            armL: K.pix(arm, 0, 10, col),
            armR: K.pix(arm.map(mirrorRow), 15, 10, col),
            head: head(front ? 'front' : 'back', v, col),
        };
    }

    /* ── From behind, bent over (the posed twerk) ──────────────── */
    /* a wide squat, knees out, hands on the knees, the torso leaning away
       (short), the hips nearest us. look = a three-quarter peek back over
       his right shoulder: cheek, one eye, brow, nose and jaw at the edge. */
    function pose(v, look) {
        v = v || variant();
        const P = palette(v), col = ch => P[ch];
        const of = v.outfit || {};
        const o = OUTFITS[of.name] || OUTFITS.tee;
        const hat = hatRuns(of, 'back', 3);
        const style = hat ? hatHair(v.hair) : v.hair;
        const low = { fade: 'f', buzz: 'f', cap: 'f' }[style] || 'h';
        const hh = style === 'buzz' || style === 'cap' ? 'f' : 'h';
        const H = (s) => s.replace(/h/g, hh);
        /* the peek's one eye and mouth follow the face, simply */
        const face = v.face || 'smile';
        const eye = face === 'joy' || face === 'laugh' ? 'o' : 'e';
        const mouth = face === 'sing' || face === 'laugh' ? 'O' : face === 'grin' ? 'k' : 'm';
        let head = look ? [
            [4, 7, H('hhhhhh')],
            [5, 6, H('hhhhhhhh')],
            [6, 5, 'o' + H('Bhhhhhhh')],
            [7, 4, 'o' + eye + 's' + H('hhhhhh') + 'so'],
            [8, 4, 'osS' + H('shhhhhh') + 'o'],
            [9, 4, 'oz' + mouth + 's' + H('hhh') + low + low + 'o'],
            [10, 5, 'ozZs' + low + low + low + 'o'],
            [11, 6, 'ooosssso'],
        ] : [
            [4, 7, H('hhhhhh')],
            [5, 6, H('hhhhhhhh')],
            [6, 5, 'o' + H('hhhhhhhh') + 'o'],
            [7, 4, 'os' + H('hhhhhhhh') + 'so'],
            [8, 5, 'o' + H('hhhhhhhH') + 'o'],
            [9, 5, 'o' + low.repeat(8) + 'o'],
            [10, 6, 'osssssso'],
        ];
        if (look && (v.shades || face === 'cool')) { head[3] = [7, 4, 'oGG' + H('hhhhhh') + 'so']; head[4] = [8, 4, 'osG' + H('shhhhhh') + 'o']; }
        const top = hat ? [] : ({
            crop: [[3, 8, 'hhhh']],
            fade: [[3, 8, 'hhhh']],
            buzz: [],
            curly: [[2, 7, 'hH.hHh'], [3, 6, 'hhHhhhHh']],
            bun: [[2, 8, 'hHHh'], [3, 9, 'XX']],
            slick: [[3, 8, 'hHHh']],
            cap: [[3, 6, 'qqqqqqqq'], [4, 6, 'qqqqqqqq'], [5, 6, 'QQQ..QQQ']],
            beanie: [[2, 8, 'qqqq'], [3, 6, 'qqqqqqqq'], [4, 6, 'qqqqqqqq'], [5, 6, 'qqqqqqqq'], [6, 6, 'QqQqQqQq']],
        }[style] || []);
        head = head.concat(top);
        if (hat) {
            /* the brim must not hide the peeking face: in the look view,
               only the parts of the hat above the brow line */
            head = head.concat(look ? hat.filter(r => r[0] <= 5 || r[1] >= 7) : hat);
        }

        /* the back, leaning away: shoulders x 3–16, the waist x 4–15, then
           the seat, inside the hips' outline (cloth, not a hole, shows
           when the hips bounce or rock) */
        let chest = [
            [11, 6, 'oSssssSo'],
            [12, 3, 'ouuuuuuuuuuuuo'],
            [13, 3, 'occcccCCccccCo'],
            [14, 4, 'occccCCcccCo'],
            [15, 4, 'occccCCcccCo'],
            [16, 5, 'oCCCCCCCCo'],
            [17, 5, 'pppppppppp'],
            [18, 4, 'pppppppppppp'],
            [19, 3, 'pppppppppppppp'],
            [20, 3, 'pppppppppppppp'],
            [21, 3, 'pppppppppppppp'],
            [22, 4, 'pppppppppppp'],
            [23, 5, 'pppppppppp'],
        ];
        if (o.body === 'hoodie') chest.splice(0, 3, [11, 5, 'oCCCCCCCCo'], [12, 3, 'occcCCCCCCccco'], [13, 3, 'occccCccCcccCo']);
        if (o.body === 'track') chest[3] = [14, 4, 'orrrrrrrrrro'];
        if (o.body === 'tank') chest.splice(1, 2, [12, 3, 'ouucsssssscuuo'], [13, 3, 'ouuccSssSccuuo']);
        if (o.body === 'bare') chest.splice(1, 4, [12, 3, 'osssssssssssso'], [13, 3, 'ossSSssssSSsso'], [14, 4, 'ossssSSsssSo'], [15, 4, 'osssssSsssSo']);
        if (o.body === 'agent' || o.body === 'liqui') chest[0] = [11, 6, 'oCCCCCCo'];
        if (o.body === 'gaucho' || o.body === 'kerchief') chest[0] = [11, 6, 'o111111o'];
        if (o.body === 'charro' || o.body === 'corto' || o.body === 'suit') chest[0] = [11, 6, 'o444444o'];
        if (o.pose) chest = o.pose(chest);
        if (of.lei) chest = chest.concat(LEI_POSE);

        /* the hips: two cheeks, back pockets (jeans / chinos: K, else
           cloth) with a shine, a thin crease low down only, a notch at the
           bottom; wider than the waist, narrower than the shoulders */
        let hips = [
            [17, 5, 'obbbbbbbbo'],
            [18, 4, 'opKKKppKKKpo'],
            [19, 3, 'oppKLKppKLKpPo'],
            [20, 3, 'opppKppppKppPo'],
            [21, 3, 'oppppppDppppPo'],
            [22, 4, 'oPppppDpppPo'],
            [23, 5, 'oPpppoppPo'],
        ];
        if (o.poseHips) hips = o.poseHips(hips);
        /* the thigh out to the knee (mostly behind the hips), the shin down */
        let legL = [
            [23, 2, 'oaaaao'],
            [24, 1, 'oaaaaAo'],
            [25, 1, 'otttTo'],
            [26, 1, 'otttTo'],
            [27, 2, 'ojjJo'],
            [28, 2, 'oiiIo'],
            [29, 1, 'onNnnno'],
            [30, 1, 'oggggggo'],
        ];
        if (o.stripe) legL.forEach((r, i) => { if (i <= 4) r[2] = r[2][0] + 'R' + r[2].slice(2); });
        if (o.leg) legL = o.leg(legL, true);
        /* the arm down to the hand on the knee */
        let armL = [
            [12, 2, 'ouuo'],
            [13, 1, 'ovvVo'],
            [14, 1, 'oVVVo'],
            [15, 1, 'owwWo'],
            [16, 0, 'owwWo'],
            [17, 0, 'owwWo'],
            [18, 0, 'owwWo'],
            [19, 0, 'owwWo'],
            [20, 0, 'oWWWo'],
            [21, 0, 'ossso'],
            [22, 0, 'ossSo'],
            [23, 0, 'ossso'],
            [24, 1, 'ooo'],
        ];
        if (o.stripe) armL.forEach((r, i) => { if (i >= 1 && i <= 8) r[2] = r[2][0] + 'r' + r[2].slice(2); });
        if (o.arm) armL = o.arm(armL, true);
        return {
            head: K.spec(head, col), hairBack: '',
            chest: K.spec(chest, col), hips: K.spec(hips, col),
            legL: K.spec(legL, col), legR: K.spec(K.mirrorRuns(legL), col),
            armL: K.spec(armL, col), armR: K.spec(K.mirrorRuns(armL), col),
        };
    }
    M.register('matrix', {
        variant: variant,
        restyle: restyle,
        parts: parts,
        pose: pose,
        views: { back: true, look: true, side: false },
        twerk: true,
        faces: FACES,
        outfits: OUTFITS,
    });
    /* for tests and contact sheets */
    M.matrixKit = { OUTFITS: OUTFITS, SKINS: SKINS, STYLES: ['crop', 'fade', 'buzz', 'curly', 'bun', 'slick', 'cap', 'beanie'],
                    FACES: FACES, FACE_ROWS: FACE_ROWS, HATWEAR: HATWEAR, CHEST: CHEST, palette: palette };
})();
