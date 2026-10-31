/* MusicGrid — "moe", an original adult East-Asian woman dancer.
 *
 * Pixel art drawn run by run on lola's skeleton (MGMascots.kit), with her
 * own face (a soft oval with a small V chin, lashed eyes with a catchlight,
 * brows, a hint of blush, a small nose and lips), her own hairstyles (hime
 * cut, long and straight with bangs, a bob with bangs, a high ponytail,
 * twin buns, a wolf cut, half-up), East-Asian skin tones, black / dark
 * brown hair and now and then a dyed colour (ash brown, burgundy, pastel
 * pink, platinum), and her own wardrobe: lola's outfits plus a pleated
 * mini skirt with a crop top and platform boots, a qipao-inspired mini
 * dress with a gold trim, and an oversized tee over bike shorts. restyle()
 * swaps the outfit mid-dance, like lola's.
 *
 * She twerks like lola, on lola's posed bodies (kit.lolaBackRuns /
 * lolaSideRuns) in her own palette: from behind with her hair from
 * behind, looking back in three-quarter (a lashed eye, a blush), and from
 * the side with her front head turned to us; her pleated mini, qipao and
 * oversized tee have their own shapes there. She may get the partner in
 * the side twerk (partner: true), like lola. Never in national dress.
 * Loads after mascots.js and before dancer.js.
 */
(function () {
    'use strict';
    const M = window.MGMascots;
    if (!M || !M.register) return;
    const K = M.kit;
    const pick = K.pick;

    /* ── Her looks ─────────────────────────────────────────────── */
    /* skin: s, S (shade), o (outline), b (blush) */
    const SKINS = {
        porcelain: { s: '#fbe4d2', S: '#ebc4aa', o: '#3a2422', b: '#f4b4b0' },
        light:     { s: '#f6d7b9', S: '#e2b692', o: '#3a2420', b: '#eea89c' },
        warm:      { s: '#ecc39c', S: '#d4a07a', o: '#36221c', b: '#e09a86' },
        tan:       { s: '#dcab82', S: '#bf8a62', o: '#32201a', b: '#cf8a74' },
    };
    const SKIN_BAG = ['porcelain', 'light', 'light', 'warm', 'warm', 'tan'];
    const EYES = ['#2a1a16', '#3a2418', '#24181a'];
    const NATURAL = ['#16141a', '#1e1618', '#16141a', '#2e2020', '#3c2a22'];
    const DYED = ['#7a6a5e', '#6e1e34', '#f2a8c4', '#e8e2d6'];   /* ash brown, burgundy, pastel pink, platinum */
    const STYLES = ['hime', 'long', 'long', 'bob', 'ponytail', 'buns', 'wolf', 'halfup', 'halfup'];
    const ACCENTS = ['#e04a6a', '#fafafc', '#26262e', '#f2c440', '#8a6ad8', '#4ab0d8'];   /* scrunchie, bow, buns ties */

    /* Her outfits, shaped like lola's (kit.OUTFITS): lola's own five plus
       her three. shape picks her sprite rows: 'pleats' (a pleated mini skirt
       over the hips), 'qipao' (a mandarin collar, a diagonal placket and a
       gold-trimmed fitted mini skirt), 'oversize' (a boxy tee to the hips,
       sleeves to the elbows, a print on the chest).
       National outfits (countries: [...], worn only to a song from there,
       see kit.pickOutfit): a yukata and a furisode-inspired kimono (Japan),
       a hanbok (Korea), a folklórico dress (Mexico), a sarafan with a
       kokoshnik (Russia), an embroidered folk blouse with a flower crown
       (Ukraine, Romania, Poland), an aloha dress with a lei (USA), a
       flamenca dress (Spain), a carnival two-piece with feathers (Brazil),
       a pollera-inspired off-shoulder blouse and full skirt (Colombia,
       Panama, Venezuela) and a bomba skirt with a head wrap (Puerto Rico,
       the Dominican Republic, Cuba). Long skirts cover the legs; the legs
       under them are the skirt's colour (thigh / shin) or bare. */
    const OUTFITS = {
        tee:    { w: 1, top: ['#fafafc', '#f6cadb', '#c8dcf4', '#1c1c22'], upper: 1, sleeves: 1, mid: 0,
                  bottom: ['#1c1c22', '#3a5a98'], thigh: 1, shin: 1, shoes: ['sneakers'] },
        bikini: { w: 1, top: ['#f2a8c4', '#20b0c0', '#fafafc', '#26262e', '#e0304a'], upper: 0, sleeves: 0, mid: 0,
                  bottom: 'same', thigh: 0, shin: 0, shoes: ['sandals'] },
        tube:   { w: 1, top: ['#26262e', '#fafafc', '#f2a8c4', '#9a4ae0'], upper: 0, sleeves: 0, mid: 0,
                  bottom: ['#3a5a98', '#e8e8f0', '#26262e'], thigh: 0, shin: 0, shoes: ['sneakers', 'heels'] },
        sports: { w: 1, top: ['#8a4ad8', '#f27aa8', '#26262e', '#30c0e0', '#e8e8f0'], upper: 0, sleeves: 0, mid: 0,
                  bottom: ['#1c1c22', '#3a3a52'], thigh: 1, shin: 0, shoes: ['sneakers'] },
        dress:  { w: 1, top: ['#1c1c22', '#c8203a', '#e8d8f0', '#3048c0', '#f2a8c4'], upper: 0, sleeves: 0, mid: 1,
                  bottom: 'same', thigh: 0, shin: 0, shoes: ['heels'] },
        pleats: { w: 2, shape: 'pleats', top: ['#fafafc', '#26262e', '#f6cadb', '#bcd2f2'], upper: 1, sleeves: 1, mid: 0,
                  bottom: ['#26262e', '#ebe3d2', '#7a2a3e', '#4a5a8a', '#cdb6e4'], thigh: 0, shin: 0, shoes: ['boots', 'boots', 'sneakers'] },
        qipao:  { w: 1, shape: 'qipao', top: ['#c8203a', '#1c3a6a', '#1e6a52', '#1c1c22', '#d8487e', '#f2ead8'], upper: 1, sleeves: 0, mid: 1,
                  bottom: 'same', thigh: 0, shin: 0, shoes: ['heels'] },
        oversize: { w: 2, shape: 'oversize', top: ['#fafafc', '#ebe3d2', '#26262e', '#bcd2f2', '#f6cadb', '#c8e0b8'], upper: 1, sleeves: 1, mid: 1,
                  bottom: ['#1c1c22', '#3a3a52'], thigh: 1, shin: 0, shoes: ['sneakers'] },

        /* national (see above) */
        yukata:   { w: 1, countries: ['japan'], shape: 'yukata',
                    top: ['#24346a', '#f2ece0', '#e89ab0', '#2e7484', '#6a4a9a', '#f4d8e4'], upper: 1, sleeves: 1, mid: 1,
                    bottom: 'same', thigh: 1, shin: 1, shoes: ['geta'] },
        furisode: { w: 1, countries: ['japan'], shape: 'furisode',
                    top: ['#c41e3a', '#22306e', '#e07a9e', '#1c1c22', '#1e5e52', '#7a2a6a'], upper: 1, sleeves: 1, mid: 1,
                    bottom: 'same', thigh: 1, shin: 1, shoes: ['zori'] },
        hanbok:   { w: 1, countries: ['korea'], shape: 'hanbok',
                    top: ['#f6e6a0', '#f6cadb', '#f6f4ee', '#cfe6c0', '#d4e4f6'], upper: 1, sleeves: 1, mid: 1,
                    bottom: ['#c8203a', '#2e4ea0', '#d8487e', '#6a3a9a', '#1e6a5a'], thigh: 1, shin: 1, shoes: ['flats'] },
        folklorico: { w: 1, countries: ['mexico'], shape: 'folk',
                    top: ['#c8203a', '#1e8a5a', '#f2b820', '#d8287e', '#2e4ec0', '#7a2ab0'], upper: 1, sleeves: 1, mid: 1,
                    bottom: 'same', thigh: 0, shin: 0, shoes: ['heels'] },
        sarafan:  { w: 1, countries: ['russia'], shape: 'sarafan',
                    top: ['#f6f4ee'], upper: 1, sleeves: 1, mid: 1,
                    bottom: ['#b01e2a', '#24347a', '#1e5a40', '#c8203a'], thigh: 1, shin: 1, shoes: ['redboots', 'heels'] },
        folkblouse: { w: 1, countries: ['ukraine', 'romania', 'poland'], shape: 'folkblouse',
                    top: ['#f6f4ee'], upper: 1, sleeves: 1, mid: 1,
                    bottom: ['#1c1c22', '#a81e2a', '#24346a', '#3a2a5a'], thigh: 1, shin: 0, shoes: ['redboots'] },
        aloha:    { w: 1, countries: ['usa'], shape: 'aloha',
                    top: ['#e04a6a', '#2a8ab0', '#f2b830', '#1e7a6a', '#f6f4ee', '#7a4ac8'], upper: 0, sleeves: 0, mid: 1,
                    bottom: 'same', thigh: 0, shin: 0, shoes: ['sandals'] },
        flamenca: { w: 1, countries: ['spain'], shape: 'flamenca',
                    top: ['#c8203a', '#1c1c22', '#f2ead8', '#2a6ab0', '#1e8a5a', '#f2b830'], upper: 1, sleeves: 1, mid: 1,
                    bottom: 'same', thigh: 1, shin: 0, shoes: ['heels'] },
        carnival: { w: 1, countries: ['brazil'], shape: 'carnival',
                    top: ['#e8b830', '#1eb0a0', '#e04a9a', '#8a4ad8', '#2a9a3a'], upper: 0, sleeves: 0, mid: 0,
                    bottom: 'same', thigh: 0, shin: 0, shoes: ['heels'] },
        pollera:  { w: 1, countries: ['colombia', 'panama', 'venezuela'], shape: 'pollera',
                    top: ['#f6f4ee'], upper: 0, sleeves: 1, mid: 1,
                    bottom: ['#f6f4ee', '#c8203a', '#f2b820', '#2a4ab0', '#e04a9a'], thigh: 0, shin: 0, shoes: ['sandals'] },
        bomba:    { w: 1, countries: ['puertorico', 'dominicanrepublic', 'cuba'], shape: 'pollera',
                    top: ['#f6f4ee', '#f2b820', '#e04a6a'], upper: 0, sleeves: 1, mid: 1,
                    bottom: ['#f6f4ee', '#c8203a', '#f2b820', '#2a4ab0'], thigh: 0, shin: 0, shoes: ['sandals'] },
    };
    /* her own shoes (the rest are lola's kit.SHOES); n 's' = bare skin */
    const SHOES = {
        boots:    { n: '#1c1c22', g: '#f2f2f6', N: true },   /* platform ankle boots: up the shin, a thick white sole */
        geta:     { n: 's', g: '#8a6444' },                  /* bare feet on wooden geta */
        zori:     { n: '#f4f2ee', g: '#c89a62' },            /* white tabi socks on zori */
        flats:    { n: '#d8487e', g: '#8a2a50' },            /* embroidered silk flats */
        redboots: { n: '#a81e2a', g: '#3a1a14', N: true },   /* red folk boots up the shin */
    };
    const PRINTS = ['#e04a6a', '#4ab0d8', '#f2c440', '#26262e', '#8a6ad8'];
    const BRIGHT = ['#c8203a', '#f2b820', '#1e8a5a', '#2e4ec0', '#d8287e', '#f6f4ee', '#7a2ab0', '#f27a3a'];

    /* the head piece each national outfit wears (see ACC below) */
    const HEADWEAR = {
        yukata: 'pin', furisode: 'kanzashi', folklorico: 'flowers', sarafan: 'kokoshnik',
        folkblouse: 'vinok', aloha: 'hibiscus', flamenca: 'rose', carnival: 'feathers',
        pollera: 'flowers', bomba: 'wrap',
    };
    const light = c => { const n = parseInt(c.slice(1), 16); return 0.3 * (n >> 16) + 0.59 * ((n >> 8) & 255) + 0.11 * (n & 255) > 150; };
    const other = (list, not) => { const l = list.filter(c => not.indexOf(c) < 0); return pick(l.length ? l : list); };

    function outfit(not, ctx) {
        const of = K.pickOutfit(not, OUTFITS, ctx && ctx.country);
        const t = of.top, b = of.bottom;
        switch (of.name) {
            case 'qipao': of.trim = t === '#f2ead8' ? '#c8203a' : '#e8c050'; break;
            case 'oversize': of.print = pick(PRINTS.filter(c => c !== t)); break;
            case 'yukata':   /* a cotton yukata: a light pattern, a bright obi and cord */
                of.collar = light(t) ? '#24346a' : '#f6f4ee';
                of.dot = light(t) ? other(['#24346a', '#c8203a', '#2e7484'], [t]) : other(['#f6f4ee', '#f4d8e4', '#e8c050'], [t]);
                of.sash = other(['#e8c050', '#c8203a', '#f2a8c4', '#24346a', '#f6f4ee', '#e07a3a'], [t, of.dot]);
                of.f1 = other(['#c8203a', '#f6f4ee', '#e8c050', '#2e7484'], [of.sash, t]);
                of.f2 = other(['#f2a8c4', '#f6f4ee', '#e8c050'], [t]);
                break;
            case 'furisode':   /* silk: flowers on the sleeves and skirt, a gold or white obi */
                of.collar = '#f6f4ee';
                of.dot = other(['#f6f4ee', '#e8c050', '#f4b8cc'], [t]);
                of.sash = other(['#e8c050', '#f6f4ee', '#d8c8e8'], [t, of.dot]);
                of.f1 = other(['#c8203a', '#e07a9e', '#2e7484'], [t]);
                of.f2 = other(['#f4b8cc', '#e8c050', '#f6f4ee'], [t]);
                break;
            case 'hanbok':   /* a white collar strip, the ribbon (goreum) and cuffs */
                of.collar = '#fbfaf6';
                of.f3 = other([b, '#c8203a', '#6a3a9a', '#2e4ea0'], [t]);
                break;
            case 'folklorico':   /* ribbons round the skirt, white lace, flowers in her hair */
                of.f1 = other(BRIGHT, [t]);
                of.f2 = other(BRIGHT, [t, of.f1]);
                of.collar = '#f6f4ee';
                break;
            case 'sarafan':   /* gold braid, red embroidery, a pearl-studded kokoshnik */
                of.f3 = b === '#c8203a' || b === '#b01e2a' ? '#24346a' : '#c8203a';
                of.collar = '#f6f4ee';
                break;
            case 'folkblouse':   /* cross-stitch, a woven sash, a flower crown */
                of.f1 = '#c8203a';
                of.f2 = pick(['#1c1c22', '#24346a']);
                of.f3 = '#2e4ec0';
                of.sash = pick(['#c8203a', '#e8b830']);
                break;
            case 'aloha':   /* a hibiscus print, a flower lei */
                of.print = other(['#f6f4ee', '#f2c440', '#f27aa8', '#e04a6a'], [t]);
                [of.f1, of.f2] = pick([['#f27aa8', '#fafafc'], ['#f2c440', '#f27a3a'], ['#c8a0e8', '#fafafc'], ['#fafafc', '#f2c440']]);
                of.f3 = other(['#e0304a', '#f27aa8', '#f6f4ee'], [t]);
                break;
            case 'flamenca':   /* polka dots, flounces edged in a contrast, a rose */
                of.dot = light(t) ? other(['#c8203a', '#1c1c22'], []) : '#f6f4ee';
                of.trim = light(t) ? of.dot : '#f6f4ee';
                of.f1 = other(['#c8203a', '#f6f4ee', '#e04a9a'], [t]);
                of.f2 = K.shade(of.f1, 0.75);
                break;
            case 'carnival':   /* sequins and a feather crown */
                of.gold = t === '#e8b830' ? '#fff2b8' : '#f2d060';
                of.f1 = other(['#e04a9a', '#1eb0a0', '#f2b820', '#8a4ad8', '#2a9a3a'], [t]);
                of.f2 = other(['#e04a9a', '#1eb0a0', '#f2b820', '#8a4ad8', '#2a9a3a', '#fafafc'], [t, of.f1]);
                of.f3 = t;
                break;
            case 'pollera': case 'bomba':   /* bands round the skirt, flowers or a head wrap */
                of.f1 = other(BRIGHT, [b, t]);
                of.f2 = other(BRIGHT, [b, t, of.f1]);
                break;
        }
        return of;
    }
    function variant(ctx) {
        const skin = pick(SKIN_BAG);
        return {
            skin: skin, skinPal: SKINS[skin],
            hair: pick(STYLES),
            colour: Math.random() < 0.25 ? pick(DYED) : pick(NATURAL),
            eyes: pick(EYES),
            accent: pick(ACCENTS),            /* scrunchie / bow / bun ties */
            earring: pick(['pearl', 'gold', 'none']),
            bangle: Math.random() < 0.35,
            outfit: outfit(null, ctx),
            face: 'smile',
        };
    }
    /* the same moe in other clothes */
    function restyle(v, ctx) {
        v = v || variant(ctx);
        return Object.assign({}, v, { outfit: outfit(v.outfit && v.outfit.name, ctx) });
    }

    /* ── Her palette: lola's letters (kit.lolaPalette) plus her own ── */
    /*   a lashes   i the catchlight (and teeth)   b blush   B a deeper blush
         d an open mouth   r brows   c the shine on her hair
         z trim / accent (the qipao's gold, a scrunchie, a bow)   p earrings
         q the tee's print   N boot shafts (else the shins)   G a sole's shade
         national outfits: A collar / lace   O obi / sash   E a pattern's dots
         F Q R ribbons, flowers, embroidery, feathers   Y gold   X leaves */
    function palette(v) {
        const of = v.outfit || { name: 'oversize', top: '#fafafc', bottom: '#1c1c22', shoes: 'sneakers', print: '#e04a6a' };
        const sk = v.skinPal || SKINS[v.skin] || SKINS.light;
        const P = K.lolaPalette(Object.assign({}, v, { skinPal: sk, outfit: of }), { l: '#d0606e' }, OUTFITS);
        const pale = ['#f2a8c4', '#e8e2d6', '#7a6a5e'].indexOf(v.colour) >= 0;
        P.a = '#1a1214';
        P.i = '#ffffff';
        P.b = sk.b;
        P.B = K.shade(sk.b, 0.88);
        P.d = '#6a2030';
        P.r = pale ? K.shade(v.colour, 0.55) : K.shade(v.colour, 1.15);
        P.c = K.shade(v.colour, v.colour === '#e8e2d6' ? 1.4 : 1.2);
        if (v.colour === '#e8e2d6') P.H = '#bcb4a8';
        P.z = of.trim || v.accent || '#e04a6a';
        P.p = v.earring === 'gold' ? '#e8c050' : '#f4f0ea';
        P.q = of.print || P.W;
        P.A = of.collar || '#f6f4ee';
        P.O = of.sash || P.z;
        P.E = of.dot || P.W;
        P.F = of.f1 || '#e04a6a';
        P.Q = of.f2 || '#f2c440';
        P.R = of.f3 || P.F;
        P.Y = of.gold || '#e8c050';
        P.X = '#3e8a46';
        const sh = SHOES[of.shoes];
        if (sh) { P.n = sh.n === 's' ? P.s : sh.n; P.g = sh.g; }
        P.N = sh && sh.N ? P.n : P.j;
        P.G = K.shade(P.g, 0.82);
        return P;
    }

    /* ── Her face: 10 wide at x 5–14, y 1–10 (a V chin one row longer) ── */
    const FACE = [
        "..oooooo..",
        ".osssssso.",
        "osrrssrrso",
        "osaassaaso",
        "osiessieso",
        "osbssSsbso",
        ".ossllsso.",
        "..osssso..",
        "...osso...",
        "....oo....",
    ];
    /* Her expressions (all positive): rows of FACE swapped by v.face.
       Closed happy eyes are calm lash-colour lines one row low (the lid
       shut, a ^ arc does not fit 2 px eyes); d = an open mouth, i = teeth,
       B = a deeper blush. */
    const FACES = ['smile', 'grin', 'joy', 'wink', 'sing', 'laugh', 'blush'];
    const SHUT = { 3: "osssssssso", 4: "osaassaaso" };
    const FACE_ROWS = {
        smile: {},
        grin:  { 6: ".osliilso.", 7: "..osllso.." },
        joy:   Object.assign({}, SHUT, { 5: "oBbssSsbBo", 6: ".osllllso." }),
        wink:  { 2: "osrrssssso", 3: "osaassssso", 4: "osiessaaso", 6: ".ossllllo." },
        sing:  { 6: ".ossddsso.", 7: "..osllso.." },
        laugh: Object.assign({}, SHUT, { 5: "osbssSsbso", 6: ".osiiiiso.", 7: "..osddso.." }),
        blush: { 4: "osiessieso", 5: "oBBssSsBBo", 6: ".osllllso." },
        /* sad faces (melancholic songs); q = a tear / raindrop */
        sad:         { 2: "ossrssrsso", 3: "osssssssso", 4: "osaassaaso", 5: "oseesSeeso", 6: ".osSllSso.", 7: "..olsslo.." },
        heartbroken: { 2: "ossrssrsso", 3: "osssssssso", 4: "osaassaaso", 5: "osqssSsqso", 6: ".osSllSso.", 7: "..olsslo.." },
        pensive:     { 4: "ossessseso", 6: ".osssllso." },
        skyward:     { 3: "osiessieso", 4: "osssssssso", 5: "osbssSsqso", 6: ".ossddsso." },
    };
    const SAD_FACES = ['sad', 'heartbroken', 'pensive'];
    function faceRows(face) {
        const swap = FACE_ROWS[face] || FACE_ROWS.smile;
        return FACE.map((r, i) => swap[i] || r);
    }

    /* ── Her hair: 18 wide at x 1–18 (index i → x = i + 1), from y -4 ── */
    /* Layers:
         F   over the face (front, head group)
         B   behind the body (front, chest group, under the chest)
         C   over the chest (front, chest group): locks over the shoulders
         K   from behind (head group, over the back of the head)
         KB  down the back (from behind, chest group, over the back) */
    const Y0 = -4, W = 18;
    function rows(map, n) {
        const out = [];
        for (let i = 0; i < n; i++) {
            const r = map[i + Y0];
            out.push(r || '..................');
        }
        return out;
    }
    const CROWN = {
        [-2]: "......hhhhhh......",
        [-1]: "....hhhhhhhhhh....",
        0:    "...hhhhcccchhhh...",
        1:    "...hhhhhhhhhhhh...",
        2:    "...hhhhhhhhhhhh...",
    };
    const BLUNT = { 3: "...hhhhhhhhhhhh..." };
    const SIDES = { 4: "...hh........hh..." };
    function hairLayers(style) {
        const F = Object.assign({}, CROWN), B = {}, C = {}, Kb = Object.assign({}, CROWN), KB = {};
        /* the back of the head, all hair, down to the nape */
        for (let y = 3; y <= 9; y++) Kb[y] = "...hhhhhhhhhhhh...";
        Kb[9] = "....hhhhhhhhhh....";
        let y;
        switch (style) {
            case 'hime':   /* blunt bangs, sidelocks cut straight at the chin, long behind */
                Object.assign(F, BLUNT, SIDES);
                for (y = 5; y <= 8; y++) F[y] = "...hh........hh...";
                F[9] = "...HH........HH...";
                for (y = 3; y <= 16; y++) B[y] = "..hhhhhhhhhhhhhh..";
                B[17] = "..HHHHHHHHHHHHHH..";
                for (y = 10; y <= 15; y++) KB[y] = y % 3 ? "....hhhhhhhhhh...." : "....hhhHhhhHhh....";
                KB[16] = "....HHHHHHHHHH....";
                break;
            case 'long':   /* long and straight with bangs, locks over the shoulders */
                Object.assign(F, BLUNT, SIDES);
                for (y = 5; y <= 9; y++) F[y] = "...hh........hh...";
                for (y = 3; y <= 15; y++) B[y] = "..hhhhhhhhhhhhhh..";
                B[16] = "...hhhhhhhhhhhh...";
                for (y = 10; y <= 14; y++) C[y] = "....hh......hh....";
                C[15] = ".....h......h.....";
                for (y = 10; y <= 15; y++) KB[y] = y % 3 ? "....hhhhhhhhhh...." : "....hhhHhhhHhh....";
                KB[16] = ".....hhHhhHhh.....";
                KB[17] = "......hhhhhh......";
                break;
            case 'bob':    /* a chin-length bob with blunt bangs, curling under */
                F[1] = "..hhhhhhhhhhhhhh..";
                F[2] = "..hhhhhhhhhhhhhh..";
                Object.assign(F, BLUNT);
                for (y = 4; y <= 8; y++) F[y] = "..hhh........hhh..";
                F[9] = "...hHH......HHh...";
                Kb[1] = F[1]; Kb[2] = F[2];
                for (y = 3; y <= 8; y++) Kb[y] = "..hhhhhhhhhhhhhh..";
                Kb[9] = "...hHhhhhhhhhHh...";
                break;
            case 'ponytail':   /* a high ponytail, side-swept bangs, a scrunchie */
                F[3] = "...hhhhHhhh..hh...";
                F[4] = "...hhh.......hh...";
                for (y = 5; y <= 7; y++) F[y] = "...h..........h...";
                /* the tail, high at the back, swinging out behind her head */
                F[-3] = "............hhh...";
                F[-2] = "......hhhhhhzhhh..";
                F[-1] = "....hhhhhhhhhhzhh.";
                for (y = 0; y <= 6; y++) F[y] = F[y] ? F[y].slice(0, 15) + (y % 2 ? 'hH.' : 'hh.') : '...............hh.';
                F[7] = F[7].slice(0, 15) + 'hH.';
                F[8] = "................h.";
                Kb[-3] = "........hh........";
                Kb[-2] = ".......hzzh.......";
                for (y = -1; y <= 9; y++) Kb[y] = Kb[y].slice(0, 8) + 'hH' + Kb[y].slice(10);
                for (y = 10; y <= 14; y++) KB[y] = "........hH........";
                KB[15] = "........h.........";
                break;
            case 'buns':   /* twin buns with ties, wispy bangs, face-framing strands */
                F[-4] = "...hhh......hhh...";
                F[-3] = "..hhchh....hhchh..";
                F[-2] = "..hhhhzhhhhzhhhh..";
                F[3] = "...hhHhhhhhhHhh...";
                F[4] = "...hhh..hh..hhh...";
                for (y = 5; y <= 8; y++) F[y] = "...h..........h...";
                Kb[-4] = F[-4]; Kb[-3] = F[-3]; Kb[-2] = F[-2];
                Kb[9] = ".....hhhhhhhh.....";
                break;
            case 'wolf':   /* a shaggy wolf cut: choppy bangs, layered, flicking out */
                F[-2] = ".....h.hhhh.h.....";
                F[-1] = "...hhhhhhhhhhhh...";
                F[0] = "..hhhhcchhcchhhh..";
                F[1] = "..hhhhhhhhhhhhhh..";
                F[2] = "..hhhhhhhhhhhhhh..";
                F[3] = "..hhhhhhhhhhhhhh..";
                F[4] = "..hhhh..hh..hhhh..";
                F[5] = ".hhh..........hhh.";
                F[6] = ".hhh..........hhh.";
                F[7] = ".hhh..........hhh.";
                F[8] = ".hh............hh.";
                F[9] = ".h..............h.";
                for (y = 3; y <= 10; y++) B[y] = "..hhhhhhhhhhhhhh..";
                B[11] = "..h.hH.hh.Hh.h....";
                for (y = -2; y <= 2; y++) Kb[y] = F[y];
                for (y = 3; y <= 8; y++) Kb[y] = ".hhhhhhhhhhhhhhhh.";
                Kb[9] = "..hhhHhhhhhhHhhh..";
                KB[10] = "....hhHhhhhHhh....";
                KB[11] = "....h.hh.hh.h.....";
                break;
            case 'halfup':   /* long, curtain bangs, the top half tied up with a bow */
            default:
                F[-4] = ".......hhhh.......";
                F[-3] = "......hhcchh......";
                F[-2] = "......hzzzzh......";
                F[2] = "...hhhhh..hhhhh...";
                F[3] = "...hhh......hhh...";
                for (y = 4; y <= 9; y++) F[y] = "...hh........hh...";
                for (y = 3; y <= 15; y++) B[y] = "..hhhhhhhhhhhhhh..";
                B[16] = "...hhhhhhhhhhhh...";
                for (y = 10; y <= 14; y++) C[y] = "....hh......hh....";
                C[15] = ".....h......h.....";
                Kb[-4] = F[-4]; Kb[-3] = F[-3]; Kb[-2] = F[-2];
                Kb[0] = "...hhhzzhhzzhhh...";
                Kb[1] = "...hhhhzzzzhhhh...";
                Kb[2] = "...hhhzzhhzzhhh...";
                for (y = 10; y <= 15; y++) KB[y] = y % 3 ? "....hhhhhhhhhh...." : "....hhhHhhhHhh....";
                KB[16] = ".....hhHhhHhh.....";
                KB[17] = "......hhhhhh......";
                break;
        }
        const n = 24;
        return { F: rows(F, n), B: rows(B, n), C: rows(C, n), K: rows(Kb, n), KB: rows(KB, n) };
    }

    /* ── Her body, front: lola's skeleton, her own rows ─────────── */
    /* chest, 12 wide at x 4–15 from y 9; rows 2–5 (y 11–14) are the bust */
    const CHEST = {
        base: [
            "....osso....",
            ".ouuUuuUuuo.",
            "owwwwwwwwwwo",
            "owwwwwwwwwwo",
            "owwwwWWwwwwo",
            ".oWWWWWWWWo.",
            "..ommmmmmo..",
            "..omMmmMmo..",
        ],
        qipao: [
            "....ozzo....",
            ".ouuuuzuuuo.",
            "owwwwwwzwwwo",
            "owwwwwwwzwwo",
            "owwwwWWwwzwo",
            ".oWWWWWWWWo.",
            "..ommmmmmo..",
            "..omMmmMmo..",
        ],
        oversize: [
            "....osso....",
            ".owwWWWWwwo.",
            "owwwwwwwwwwo",
            "owwwqqwqqwwo",
            "owwwqqqqqwwo",
            "oWwwwqqqwwWo",
            "owwwwwqwwwwo",
            "oWwwwwwwwwWo",
        ],
        /* a wrapped robe, left over right: the collar (A) makes a 'y', the
           outer panel's edge running down to her right; the obi (O) and
           its cord (F) at the waist */
        yukata: [
            "...oAssAo...",
            ".owwAssAwwo.",
            "owwwwAsAwwwo",
            "owEwwwAwwEwo",
            "owwWwAwwwWwo",
            ".oWwAwEwwWo.",
            "..oOOOOOOo..",
            "..oOOFFOOo..",
        ],
        /* a short jacket (jeogori) with a white collar strip, the long
           ribbon (R) tied at the chest, the skirt (chima) from the bust */
        hanbok: [
            "...oAssAo...",
            ".owwAssAwwo.",
            "owwwwAAwwwwo",
            "owWwRRRwwWwo",
            "okkkkRkRkkko",
            "okkkkRkkRkko",
            "okKkkRkkRkKo",
            "okKkkkkkkRKo",
        ],
        /* folklórico: a high lace yoke, the dress's colour, a ribbon belt */
        folk: [
            "....oAAo....",
            ".owwAAAAwwo.",
            "owwwAwwAwwwo",
            "owwWwwwwWwwo",
            "owwwwwwwwwwo",
            ".oWwwwwwwWo.",
            "..oFFFFFFo..",
            "..okkkkkko..",
        ],
        /* off the shoulder: two ruffles across the bust */
        pollera: [
            "....osso....",
            ".osssssssso.",
            "owWwWwWwWwWo",
            "oWwWwWwWwWwo",
            "owwwwwwwwwwo",
            ".oWwwwwwwWo.",
            "..oFFFFFFo..",
            "..okkkkkko..",
        ],
        /* a white blouse under the sarafan, gold braid (Y) down the front */
        sarafan: [
            "....osso....",
            ".owwwRRwwwo.",
            "owYYYYYYYYwo",
            "owkkkYYkkkwo",
            "owkKkYYkKkwo",
            ".okkkYYkkko.",
            "..okkYYkko..",
            "..okkYYkko..",
        ],
        /* an embroidered blouse (F, Q cross-stitch) and a woven sash (O) */
        folkblouse: [
            "....osso....",
            ".owwwFFwwwo.",
            "owwwFQQFwwwo",
            "owwwwFFwwwwo",
            "owwWwFFwWwwo",
            ".oWwwQQwwWo.",
            "..oOFOOFOo..",
            "..okkkkkko..",
        ],
        /* a sundress with a print (q) and a flower lei (F, Q) */
        aloha: [
            "....osso....",
            ".osFQssQFso.",
            "owwQwwwwFwwo",
            "owwFqwwqQwwo",
            "owwWQFQFwWwo",
            ".oWwqwwqwWo.",
            "..ommqmmmo..",
            "..omMmmMmo..",
        ],
        /* fitted, polka dots (E) */
        flamenca: [
            "....osso....",
            ".owwwsswwwo.",
            "owEwwsswwEwo",
            "owwwwwwwwwwo",
            "owWwwEwwwWwo",
            ".oWwwwwwEWo.",
            "..owEwwEwo..",
            "..owwwwwwo..",
        ],
        /* a sequinned (Y) top */
        carnival: [
            "....osso....",
            ".ouuUuuUuuo.",
            "owwYwwwwYwwo",
            "oYwwwYYwwwYo",
            "owwWYwwYWwwo",
            ".oYWWWWWWYo.",
            "..ommmmmmo..",
            "..omMmmMmo..",
        ],
    };
    CHEST.furisode = CHEST.yukata;
    const CHEST_BACK = {
        base: [
            "...osso...",
            "ouuuuuuuuo",
            "owwwwwwwwo",
            "owwwwwwwWo",
            "oWwwwwwwWo",
            ".oWWWWWWo.",
            ".ommmMmmo.",
            ".ommmMmmo.",
        ],
        qipao: [
            "...ozzo...",
            "ouuuuuuuuo",
            "owwwwwwwwo",
            "owwwwwwwWo",
            "oWwwwwwwWo",
            ".oWWWWWWo.",
            ".ommmMmmo.",
            ".ommmMmmo.",
        ],
        oversize: [
            "..oossoo..",
            "owwwwwwwwo",
            "owwwwwwwwo",
            "owwwwwwwWo",
            "oWwwwwwwWo",
            "owwwwwwwwo",
            "owwwwwwwwo",
            "oWwwwwwwWo",
        ],
        yukata: [
            "...oAAo...",
            "owwwwwwwwo",
            "owwEwwwwwo",
            "owwwwwwEwo",
            "oWwwwwwwWo",
            "oWwEwwwwWo",
            ".oOOOOOOo.",
            ".oOOOOOOo.",
        ],
        hanbok: [
            "...oAAo...",
            "owwwwwwwwo",
            "owwwwwwwwo",
            "owwwwwwwWo",
            "okkkkkkkko",
            "okkkkkkkko",
            "okKkkkkKko",
            "okKkkkkKko",
        ],
        folk: [
            "...oAAo...",
            "owwwwwwwwo",
            "owwwwwwwwo",
            "owwwwwwwWo",
            "oWwwwwwwWo",
            ".oWWWWWWo.",
            ".oFFFFFFo.",
            ".okkkkkko.",
        ],
        pollera: [
            "...osso...",
            "osssssssso",
            "owWwWwWwWo",
            "oWwWwWwWwo",
            "owwwwwwwwo",
            ".oWWWWWWo.",
            ".oFFFFFFo.",
            ".okkkkkko.",
        ],
        sarafan: [
            "...osso...",
            "owwwwwwwwo",
            "owYYYYYYwo",
            "owkkkkkkwo",
            "okkkkkkkko",
            ".okkkkkko.",
            ".okkkkkko.",
            ".okkKkkko.",
        ],
        folkblouse: [
            "...osso...",
            "owwwwwwwwo",
            "owwwwwwwwo",
            "owwwwwwwWo",
            "oWwwwwwwWo",
            ".oWWWWWWo.",
            ".oOFOOFOo.",
            ".okkkkkko.",
        ],
        aloha: [
            "...oQFo...",
            "ouuuuuuuuo",
            "owwwqwwwwo",
            "owwwwwwqWo",
            "oWwqwwwwWo",
            ".oWWWWWWo.",
            ".ommmqmmo.",
            ".ommmMmmo.",
        ],
        flamenca: [
            "...osso...",
            "owwwwwwwwo",
            "owwEwwwEwo",
            "owwwwwwwWo",
            "oWwEwwEwWo",
            ".oWWWWWWo.",
            ".owwEwwwo.",
            ".owwwwwwo.",
        ],
        carnival: [
            "...osso...",
            "ouuuuuuuuo",
            "owwYwwYwwo",
            "oYYYYYYYYo",
            "oSssssssSo",
            ".oSssssSo.",
            ".ommmmmmo.",
            ".omMmmMmo.",
        ],
    };
    CHEST_BACK.furisode = CHEST_BACK.yukata;
    /* hips: [x, rows] from y 17 (long skirts reach the ankles, y 27) */
    const HIPS = {
        base: [5, [
            "oKkkkkkkKo",
            "okkkkkkkko",
            "okkkkkkkko",
            "okkkkkkkko",
        ]],
        pleats: [3, [
            "..oKkkkkkkKo..",
            "..okkDkkDkko..",
            ".okkDkkkkDkko.",
            ".okDkkDDkkDko.",
            "okkDkkDDkkDkko",
            "okDkkDkkDkkDko",
            "oooooooooooooo",
        ]],
        qipao: [4, [
            ".oKkkkkkkKo.",
            ".okkkkkkkko.",
            ".okkkkkkkKo.",
            "okkkkkkkkkko",
            "okzkkkkkkkko",
            "ozzzzzzzzzzo",
            "oooooooooooo",
        ]],
        oversize: [4, [
            "owwwwwwwwwwo",
            "oWwwwwwwwwWo",
            "oWWWWWWWWWWo",
            ".okkkkkkkko.",
        ]],
        /* a straight robe to the ankles, the outer panel's edge (W) */
        yukata: [5, [
            "owwwWwwwwo",
            "owEwWwwwEo",
            "owwwWwwwwo",
            "owwWwwEwwo",
            "oEwWwwwwwo",
            "owwWwwwwEo",
            "owwWwEwwwo",
            "owWwwwwwwo",
            "oEWwwwwEwo",
            "owWwwwwwwo",
            "oooooooooo",
        ]],
        /* the chima, full and pleated (K) to the ankles */
        hanbok: [3, [
            ".okKkkkkkkKko.",
            ".okKkkkkkkKko.",
            ".oKkkkKkkkkKo.",
            "okKkkkKkkkkKko",
            "okKkkkKkkkkKko",
            "oKkkkkKkkkkkKo",
            "oKkkkkKkkkkkKo",
            "okkkkkkKkkkkko",
            "okkkkkkKkkkkko",
            "oKkkkkkKkkkkKo",
            "oooooooooooooo",
        ]],
        /* a very full skirt with two ribbon bands (F, Q) and lace (A) */
        folk: [2, [
            "...okkkkkkkko...",
            "..okkkKkkKkkko..",
            "..okkKkkkkKkko..",
            ".okkkKkkkkKkkko.",
            ".okkKkkkkkkKkko.",
            "okkkKkkkkkkKkkko",
            "oFFFFFFFFFFFFFFo",
            "okkKkkkkkkkkKkko",
            "oQQQQQQQQQQQQQQo",
            "oAkAkAkAkAkAkAko",
            "oooooooooooooooo",
        ]],
        /* the same fullness, flounced, bands near the hem */
        pollera: [2, [
            "...okkkkkkkko...",
            "..okkkKkkKkkko..",
            "..okkKkkkkKkko..",
            ".okkkKkkkkKkkko.",
            ".oFFFFFFFFFFFFo.",
            "okkkKkkkkkkKkkko",
            "okkKkkkkkkkkKkko",
            "oQQQQQQQQQQQQQQo",
            "okkkkkkkkkkkkkko",
            "oFFFFFFFFFFFFFFo",
            "oooooooooooooooo",
        ]],
        /* the sarafan to the ankles, gold braid down the front and round the hem */
        sarafan: [4, [
            ".okkkYYkkko.",
            ".okkkYYkkko.",
            ".okKkYYkKko.",
            "okkKkYYkKkko",
            "okkKkYYkkKko",
            "okKkkYYkkKko",
            "okKkkYYkkkKo",
            "okkkkYYkkkko",
            "oYYYYYYYYYYo",
            "okkkkkkkkkko",
            "oooooooooooo",
        ]],
        /* a straight wrap skirt to mid-calf, an embroidered hem */
        folkblouse: [4, [
            ".okkkkkkkko.",
            ".okkKkkKkko.",
            ".okkKkkKkko.",
            "okkkKkkKkkko",
            "okkkKkkKkkko",
            "okkkKkkKkkko",
            "oFFQFFQFFQFo",
            "oooooooooooo",
        ]],
        /* the sundress to the knee */
        aloha: [4, [
            ".okkkkkqkko.",
            ".okqkkkkkko.",
            "okkkkkqkkkko",
            "okkKkkkkKqko",
            "oqkKkkkkKkko",
            "okKkkqkkkKko",
            "oooooooooooo",
        ]],
        /* fitted to the knee, then flounces edged in the trim (z) */
        flamenca: [2, [
            "...owwEwwwwo....",
            "...owwwwwEwo....",
            "...oEwwwwwwo....",
            "...owwwEwwwo....",
            "..owwwwwwwEwo...",
            "..owEwwwwEwwo...",
            ".ozzzzzzzzzzzo..",
            ".owwEwwwwEwwwwo.",
            "ozzzzzzzzzzzzzzo",
            "owwwEwwwwwEwwwwo",
            "oooooooooooooooo",
        ]],
        /* a short sequinned skirt with a fringe */
        carnival: [4, [
            ".oYYYYYYYYo.",
            ".okkkkkkkko.",
            "okkYkkkkYkko",
            "okkkkkkkkkko",
            "oYkYkYkYkYko",
            ".k.k.k.k.k..",
        ]],
    };
    HIPS.furisode = HIPS.yukata;
    const HIPS_BACK = {
        base: [5, [
            "oKkkkkkkKo",
            "okkkkKkkko",
            "okkkKKkkko",
            "okkkkKkkko",
        ]],
        qipao: [4, [
            ".oKkkkkkkKo.",
            ".okkkkkkkko.",
            ".okkkkKkkko.",
            "okkkkKKkkkko",
            "okkkkkKkkkko",
            "ozzzzzzzzzzo",
            "oooooooooooo",
        ]],
        /* the obi's knot at the back */
        yukata: [5, [
            "owOOOOOOwo",
            "owOFFFFOwo",
            "owOOOOOOwo",
            "owwwwwwwwo",
            "owEwwwwEwo",
            "owwwwwwwwo",
            "owwwEwwwwo",
            "owwwwwwEwo",
            "oEwwwwwwwo",
            "owwwwEwwwo",
            "oooooooooo",
        ]],
        /* a grand bow for the furisode */
        furisode: [3, [
            ".oOOOOOOOOOOo.",
            "oOOOYOOOOYOOOo",
            ".oOOOOOOOOOOo.",
            "..owwwwwwwwo..",
            "..owEwwwwEwo..",
            "..owwwwwwwwo..",
            "..owwwEwwwwo..",
            "..owwwwwwEwo..",
            "..oEwwwwwwwo..",
            "..owwwwEwwwo..",
            "..oooooooooo..",
        ]],
    };
    /* the sarafan's braid is only down the front */
    HIPS_BACK.sarafan = [4, HIPS.sarafan[1].map(r => /^oY+o$/.test(r) ? r : r.replace('YY', 'kk'))];
    /* arms, 4 wide at x 2 (mirrored at x 14) from y 10 */
    const ARMS = {
        base: [".ovv", "ovVv", "osso", "osso", "osso", "osSo", "osso", "osSo", "osso", ".oo."],
        oversize: [".ovv", "ovvv", "ovVv", "ovVv", "oVVV", "osso", "osso", "osSo", "osso", ".oo."],
        /* the yukata's sleeves to the wrist */
        yukata: [".ovv", "ovvv", "ovvv", "ovEv", "ovvv", "ovvv", "oVVV", "osso", "osSo", ".oo."],
        /* the furisode's long sleeves, flowered (E), hanging past the hand */
        furisode: [".ovv", "ovvv", "ovEv", "ovvv", "oEvv", "ovvE", "ovvv", "oEvs", "oVVs", ".oo."],
        /* hanbok: full sleeves, a coloured cuff (R) */
        hanbok: [".ovv", "ovvv", "ovVv", "ovvv", "ovvv", "ovVv", "ovvv", "oRRo", "osso", ".oo."],
        /* puffed short sleeves */
        folk: [".ovv", "ovvv", "oVVV", "osso", "osso", "osSo", "osso", "osSo", "osso", ".oo."],
        /* full white sleeves, embroidered cuffs */
        sarafan: [".ovv", "ovvv", "ovVv", "ovvv", "ovVv", "ovvv", "oRRR", "osso", "osSo", ".oo."],
        folkblouse: [".ovv", "ovFv", "oFQF", "ovFv", "ovvv", "ovvv", "oFFF", "osso", "osSo", ".oo."],
        /* to the elbow, a ruffle (z) */
        flamenca: [".ovv", "ovvv", "ovEv", "ovvv", "ozzz", "osso", "osso", "osSo", "osso", ".oo."],
        /* gold arm cuffs */
        carnival: [".ouu", "ouUu", "osso", "oYYo", "osso", "osSo", "osso", "oYYo", "osso", ".oo."],
    };
    /* legs, 6 wide at x 4 (mirrored at x 10) from y 20 */
    const LEGS = [
        ".ottTo", ".ottTo", ".ottTo", "..otTo",
        "..ojjo", "..oNjo", "..oNNo", "..oNNo",
        "onnnno", "oggGgo",
    ];

    /* ── Head pieces for the national outfits: [y0, rows 18 wide at x 1],
       drawn over the hair (mirrored from behind). cover: true wears the
       hair down (no buns / tail / half-up knot poking through). ── */
    const ACC = {
        /* a small flower hairpin */
        pin: [-1, [
            "..............F...",
            ".............FQF..",
            "..............F...",
        ]],
        /* a kanzashi: a flower cluster with dangling strands */
        kanzashi: [-2, [
            ".............FF...",
            "............FQQF..",
            "............FQQF..",
            ".............FF...",
            "..............Y...",
            "..............Y...",
            "..............A...",
        ]],
        /* flowers tucked over the ear */
        flowers: [-2, [
            "............FF....",
            "...........FYYF...",
            "............FFQQ..",
            ".............QYYQ.",
            "..............QQ..",
        ]],
        /* a hibiscus behind the ear */
        hibiscus: [-1, [
            "..............R...",
            ".............RRR..",
            "............XRYRR.",
            ".............RRR..",
            "..............X...",
        ]],
        /* a rose on the crown */
        rose: [-3, [
            "..........FFF.....",
            ".........FFQFF....",
            ".........FQQQF....",
            "..........FFF.....",
            "...........X......",
        ]],
        /* a kokoshnik: a tall crescent, gold braid, pearls */
        kokoshnik: [-6, [
            ".......oooo.......",
            ".....ookkkkoo.....",
            "....okkAkkAkko....",
            "....okYkkkkYko....",
            "...okkkkYYkkkko...",
            "...oYYYYYYYYYYo...",
        ], true],
        /* a vinok: a crown of flowers and leaves */
        vinok: [-3, [
            "...FF.YY..RR.FF...",
            "..XFFXYYXXRRXFFX..",
        ]],
        /* a feather crown on a sequinned band */
        feathers: [-6, [
            "....F..Q..Q..F....",
            "...FF.QQ..QQ.FF...",
            "...FFRQQRRQQRFF...",
            "....FRRQQQQRRF....",
            ".....oYAYYAYo.....",
            "....oYYYYYYYYo....",
        ], true],
        /* a head wrap tied on top */
        wrap: [-4, [
            ".......oFFo.......",
            "....ooFFQQFFoo....",
            "...oFFFFFFFFFFo...",
            "..oFFQFFFFFFQFFo..",
            "..oFFFFFFFFFFFFo..",
            "..oQFFFFFFFFFFQo..",
            "..oFFFQFFFFQFFFo..",
        ], true],
    };
    const DOWN = { ponytail: 'long', buns: 'long', halfup: 'long' };

    function parts(view, v) {
        v = v || variant();
        const back = view !== 'front';
        const P = palette(v);
        const col = ch => P[ch];
        const of = v.outfit || {};
        const shape = (OUTFITS[of.name] || {}).shape || 'base';
        const acc = ACC[HEADWEAR[of.name]];
        const hair = hairLayers(acc && acc[2] && DOWN[v.hair] ? DOWN[v.hair] : v.hair);
        const hx = 1, hy = Y0;
        const accRows = acc ? (back ? K.mirror(acc[1]) : acc[1]) : null;
        const headwear = acc ? K.pix(accRows, hx, acc[0], col) : '';

        /* the arms: a bangle on the wrist now and then */
        const arm = (ARMS[shape] || ARMS.base).slice();
        if (v.bangle && arm[7] === 'osSo') arm[7] = 'ozzo';

        let head, chest, hips;
        if (back) {
            const backFace = FACE.slice(0, 9).map(r => r.replace(/[^.o]/g, 'h'));
            head = K.pix(backFace, 5, 1, col) + K.pix(hair.K, hx, hy, col) + headwear;
            const cb = CHEST_BACK[shape] || CHEST_BACK.base;
            chest = K.pix(cb, 5, 9, col) + K.pix(hair.KB, hx, hy, col);
            const hp = HIPS_BACK[shape] || HIPS[shape] || HIPS_BACK.base;
            hips = K.pix(hp[1], hp[0], 17, col);
        } else {
            const ear = v.earring === 'none' || !{ ponytail: 1, buns: 1 }[v.hair] || (acc && acc[2]) ? '' :
                '<rect x="4" y="7" width="1" height="1" fill="' + P.p + '"/><rect x="15" y="7" width="1" height="1" fill="' + P.p + '"/>';
            head = K.pix(faceRows(v.face), 5, 1, col) + K.pix(hair.F, hx, hy, col) + headwear + ear;
            /* the bust rows (y 11–14) jiggle on their own (kit.bustGroup),
               with the hair locks that lie over them */
            const cr = CHEST[shape] || CHEST.base;
            const lock = (a, b) => K.pix(hair.C.map((r, i) => (i + Y0 >= a && i + Y0 <= b) ? r : '..................'), hx, hy, col);
            /* hair behind the body stops where the skirt is: the hips are
               drawn under the chest, so cut it out of the hips' pixels */
            const hp = HIPS[shape] || HIPS.base;
            const hairB = hair.B.map((r, i) => {
                const hr = hp[1][i + Y0 - 17];
                if (!hr) return r;
                return r.split('').map((ch, x) => { const c = hr[x + hx - hp[0]]; return c && c !== '.' ? '.' : ch; }).join('');
            });
            chest = K.pix(hairB, hx, hy, col) + K.pix(cr.slice(0, 2), 4, 9, col) + K.pix(cr.slice(6), 4, 15, col) +
                    lock(-99, 10) + lock(15, 99) +
                    K.bustGroup(K.pix(cr.slice(2, 6), 4, 11, col) + lock(11, 14));
            hips = K.pix(hp[1], hp[0], 17, col);
        }
        return {
            legL: K.pix(LEGS, 4, 20, col),
            legR: K.pix(K.mirror(LEGS), 10, 20, col),
            hips: hips,
            chest: chest,
            armL: K.pix(arm, 2, 10, col),
            armR: K.pix(K.mirror(arm), 14, 10, col),
            head: head,
        };
    }

    /* ── Twerking: lola's posed bodies (kit.lolaBackRuns / lolaSideRuns,
       plain: no national dress) in her palette, with her own head, hair
       and outfit shapes. Nobody twerks in national dress (dancer.js). ── */
    const LONG = { hime: 1, long: 1, halfup: 1 };
    const boot = runs => runs.map(r => [r[0], r[1], r[2].replace(/j/g, 'N')]);   /* N: boot shafts, else shins */
    /* her mini skirts on the posed bodies: pleats, or the qipao's fitted one with its gold hem */
    const MINI = { pleats: { skirt: 'pleat' }, qipao: { skirt: 'knee', hem: 'z' } };

    /* From behind, bent over (the posed twerk): her hair from behind;
       look = the three-quarter peek over her shoulder, a lashed eye, a
       blush, her lips (open when she sings or laughs) */
    function pose(v, look) {
        v = v || variant();
        const P = palette(v), col = ch => P[ch];
        const of = v.outfit || {};
        const shape = (OUTFITS[of.name] || {}).shape || 'base';
        const r = K.lolaBackRuns(Object.assign({}, v, { hair: 'pixie' }), look, true);
        let head = r.head.map(x => x.slice()), behind = [], hips = r.hips, legL = boot(r.legL), armL = r.armL;
        const face = v.face || 'smile';
        if (look) {
            const at = (y, x) => head.find(h => h[0] === y && h[1] === x);
            const eye = at(7, 4), cheek = at(8, 4), lips = at(9, 5);
            if (face === 'joy' || face === 'laugh') eye[2] = 'oa' + eye[2].slice(2);
            else eye[2] = 'ae' + eye[2].slice(2);
            head.push([6, 4, 'a']);
            if (cheek) cheek[2] = 'osb' + cheek[2].slice(3);
            if (lips && (face === 'sing' || face === 'laugh')) lips[2] = 'od' + lips[2].slice(2);
            /* lola's earring → hers (only with her hair up) */
            head = head.filter(h => !(h[0] === 8 && h[1] === 14));
            if (v.earring !== 'none' && { ponytail: 1, buns: 1 }[v.hair]) head.push([8, 14, 'p']);
        }
        const nape = n => head.push([11, 8, n]);
        switch (v.hair) {
            case 'hime':
                nape('hhhh');
                behind = [[10, 6, 'hhhhhhhh'], [11, 6, 'hhhhhhhh'], [12, 6, 'hhhHhhhh'], [13, 6, 'hhhhhhhh'], [14, 6, 'HHHHHHHH']];
                break;
            case 'long': case 'halfup':
                nape('hhhh');
                behind = [[10, 6, 'hhhhhhhh'], [11, 6, 'hhhhhhhh'], [12, 6, 'hhhHhhhh'], [13, 6, 'hHhhhhHh'], [14, 7, 'hhhhhh'], [15, 8, 'hHhh']];
                if (v.hair === 'halfup') head.push([4, 8, 'cc'], [5, 7, 'zzz'], [5, 10, 'zzz'], [6, 9, 'zz']);
                break;
            case 'bob':
                nape('hhhh');
                head.push([6, 5, 'h'], [6, 14, 'h']);
                behind = [[10, 6, 'hhhhhhhh'], [11, 6, 'hHhhhhHh']];
                break;
            case 'ponytail':
                nape('ohHo');
                head.push([3, 9, 'zz'], [4, 9, 'hH'], [5, 9, 'hH'], [6, 9, 'hH'], [7, 9, 'hH'], [8, 9, 'hH'], [9, 9, 'hH'],
                          [10, 9, 'hH'], [12, 9, 'hH'], [13, 9, 'h']);
                break;
            case 'buns':
                head.push([2, 6, 'hh'], [3, 5, 'hhch'], [4, 6, 'zz'], [2, 12, 'hh'], [3, 11, 'hchh'], [4, 12, 'zz']);
                break;
            case 'wolf':
                head.push([6, 5, 'h'], [6, 14, 'h'], [7, 5, 'h'], [7, 14, 'h']);
                behind = [[10, 6, 'hhHhhHhh'], [11, 6, 'hh.hh.hh'], [12, 7, 'h..h']];
                break;
        }
        const d = MINI[shape];
        if (d) hips = K.skirtRuns(d, 17, true);
        if (shape === 'oversize') hips = hips.concat([[17, 4, 'owwwwwwwwwwo'], [18, 4, 'oWWWWWWWWWWo']]);
        if (v.bangle) armL = armL.map(x => (x[0] === 20 ? [x[0], x[1], 'ozzo'] : x));
        return {
            head: K.spec(head, col), hairBack: K.spec(behind, col),
            chest: K.spec(r.chest, col), hips: K.spec(hips, col),
            legL: K.spec(legL, col), legR: K.spec(K.mirrorRuns(legL), col),
            armL: K.spec(armL, col), armR: K.spec(K.mirrorRuns(armL), col),
        };
    }

    /* From the side, bent over (the side twerk), on lola's side body: her
       front head turned to us (every expression), the hair flipped so a
       ponytail swings behind, long hair hanging down her back */
    function side(v) {
        v = v || variant();
        const P = palette(v), col = ch => P[ch];
        const of = v.outfit || {};
        const shape = (OUTFITS[of.name] || {}).shape || 'base';
        const r = K.lolaSideRuns(v, true);
        let far = boot(r.far), chest = r.chest.map(x => x.slice()), hips = r.hips, leg = boot(r.leg), arm = r.arm, seat = r.seat;
        const d = MINI[shape];
        if (d) {
            const end = 23;
            hips = K.sideSkirt(d, end);
            seat = K.seatOf(hips);
            leg = leg.filter(x => x[0] > end); far = far.filter(x => x[0] > end);
        }
        if (shape === 'qipao') chest.forEach(x => { if (x[0] === 11) x[2] = 'ozzzzo'; });   /* the mandarin collar */
        if (shape === 'oversize') {
            /* the boxy tee hangs over the top of her hips, a print on the chest */
            hips = hips.concat([[17, 4, 'owwwwwo'], [18, 3, 'oWWWWWo']]);
            chest = chest.concat([[13, 15, 'qq'], [14, 15, 'qq']]);
        }
        if (v.bangle) arm = arm.map(x => (x[0] === 21 ? [x[0], x[1], 'ozzo'] : x));

        const acc = ACC[HEADWEAR[of.name]];
        const hair = hairLayers(acc && acc[2] && DOWN[v.hair] ? DOWN[v.hair] : v.hair);
        const ear = v.earring === 'none' || !{ ponytail: 1, buns: 1 }[v.hair] ? '' :
            '<rect x="4" y="7" width="1" height="1" fill="' + P.p + '"/><rect x="15" y="7" width="1" height="1" fill="' + P.p + '"/>';
        let hang = [];
        if (LONG[v.hair]) {
            hang = [[4, 8, 'hh'], [5, 7, 'hhH'], [6, 7, 'hhH'], [7, 6, 'hhH'], [8, 6, 'hhH'], [9, 5, 'hhH'], [10, 5, 'hhH'],
                    [11, 4, 'hhH'], [12, 4, 'hhH'], [13, 4, 'hHh'], [14, 4, 'hh']];
            if (v.hair === 'hime') hang.push([15, 4, 'HH']);
        }
        if (v.hair === 'wolf') hang = [[8, 7, 'hh'], [9, 6, 'hhH'], [10, 6, 'hH'], [11, 6, 'h']];
        const front = K.pix(faceRows(v.face), 5, 1, col) + K.pix(K.mirror(hair.F), 1, Y0, col) +
                      (acc ? K.pix(K.mirror(acc[1]), 1, acc[0], col) : '') + ear;
        return {
            legL: K.spec(leg, col), legR: '',
            hips: K.spec(hips, col),
            chest: K.spec(far, col) + K.spec(chest, col) + K.spec(seat, col),
            armL: '', armR: K.spec(arm, col),
            head: K.spec(hang, col) + K.shiftRects(front, 6, 0),
        };
    }

    M.register('moe', {
        variant: variant,
        restyle: restyle,
        parts: parts,
        faces: FACES, sadFaces: SAD_FACES, extraFaces: ['skyward'],
        outfits: OUTFITS,
        pose: pose,
        side: side,
        views: { back: true, look: true, side: true },
        twerk: true,
        partner: true,
    });
})();
