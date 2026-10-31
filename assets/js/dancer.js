/* MusicGrid — the dancer: when a song has no lyrics, a mascot dances on
 * the lyrics stage instead, picking random moves from its genre's pool
 * (plus a few steps typical of the song's country, MOVES_BY_COUNTRY).
 * The mascots themselves are drawn in assets/js/mascots.js (MGMascots).
 *
 *   MGDancer.show(album, stageEl)   a mascot (random, never twice in a row,
 *                                   or the one picked in 🕺 Mascots) dances
 *   MGDancer.hide()                 gone (lyrics turned up, or a new song)
 *
 * The moves are CSS animations (assets/css/grid.css, .dancer / .mv-*); they
 * pause with the song (#lyricsSection:not(.playing)) and stand still under
 * prefers-reduced-motion.
 */
(function () {
    'use strict';

    const M = window.MGMascots;
    /* lola, moe, matrix, crt: mascots.js plus the mascot-*.js files that
       register before this one loads (a live array) */
    const NAMES = M.names;

    /* Genre → the moves it picks from (weighted by repeats). Reggaeton
       twerks; moe never twerks and dances it with other moves instead. */
    const MOVES = {
        reggaeton:  ['twerk', 'twerklook', 'twerkside', 'twerk', 'twerklook', 'twerkside', 'shimmy', 'bounce', 'cumbia',
                     'macarena', 'cabbagepatch', 'bodyroll', 'merengue', 'samba',
                     'bachatahip', 'bachatawave', 'bachatastyle', 'salsaon1', 'merenguewalk', 'sonidera'],
        latin:      ['salsa', 'cumbia', 'salsa', 'sway', 'spin', 'twist', 'shimmy', 'tango', 'macarena', 'zapateado', 'hustle',
                     'samba', 'merengue', 'bachata', 'son', 'calena',
                     'salsaon1', 'salsaon1', 'crossbody', 'salsaspin', 'suzyq', 'salsaarms',
                     'bachatahip', 'bachatawave', 'bachataturn', 'bachatastyle',
                     'merenguewalk', 'cumbiavela', 'sonidera'],
        rock:       ['headbang', 'headbang', 'airguitar', 'jump', 'stomp', 'pogo', 'skank', 'runningman', 'charleston',
                     'windmill', 'windmill', 'fistpump', 'swagger', 'pony'],
        metal:      ['headbang', 'headbang', 'airguitar', 'stomp', 'pogo', 'skank', 'runningman',
                     'windmill', 'windmill', 'fistpump', 'powerstomp', 'prisyadka'],
        punkska:    ['pogo', 'pogo', 'jump', 'kick', 'stomp', 'headbang', 'skank', 'skank', 'runningman', 'polka',
                     'fistpump', 'windmill', 'swagger', 'humppa', 'pony'],
        electronic: ['robot', 'shuffle', 'armwave', 'pogo', 'wave', 'point', 'runningman', 'glide', 'sprinkler', 'float',
                     'parapara', 'fistpump', 'bodyroll', 'kpop', 'handsup', 'handsup'],
        hiphop:     ['bounce', 'armwave', 'shuffle', 'robot', 'floss', 'stomp', 'wave', 'runningman', 'cabbagepatch', 'glide', 'sprinkler',
                     'bodyroll', 'bodyroll', 'fistpump', 'powerstomp', 'kpop', 'handsup'],
        pop:        ['bounce', 'spin', 'clap', 'point', 'floss', 'jump', 'kick', 'macarena', 'idol', 'hustle', 'sprinkler',
                     'kpop', 'bodyroll', 'fistpump', 'linedance', 'handsup', 'pony', 'bachatahip'],
        citypop:    ['sway', 'point', 'spin', 'clap', 'twist', 'wave', 'idol', 'idol', 'hustle', 'snaps', 'glide',
                     'parapara', 'bodyroll', 'swagger'],
        funksoul:   ['point', 'shimmy', 'twist', 'shuffle', 'spin', 'bounce', 'hustle', 'glide', 'snaps', 'cabbagepatch',
                     'bodyroll', 'bodyroll', 'son', 'samba', 'fistpump', 'lindy', 'pony', 'salsaon1'],
        jazz:       ['sway', 'shimmy', 'spin', 'conduct', 'clap', 'twist', 'charleston', 'charleston', 'snaps', 'snaps', 'glide',
                     'waltz', 'son', 'bodyroll', 'swagger', 'lindy', 'lindy', 'salsaon1'],
        indie:      ['sway', 'bounce', 'armwave', 'clap', 'sidehop', 'wave', 'snaps', 'float', 'polka', 'runningman',
                     'swagger', 'swagger', 'fistpump', 'waltz', 'pony', 'twostep'],
        folk:       ['sway', 'clap', 'stomp', 'sidehop', 'kick', 'polka', 'polka', 'zapateado', 'lasso',
                     'hora', 'jarabe', 'humppa', 'prisyadka', 'linedance', 'twostep', 'hula'],
        americana:  ['stomp', 'sway', 'clap', 'sidehop', 'kick', 'lasso', 'lasso', 'zapateado', 'polka', 'charleston',
                     'linedance', 'linedance', 'waltz', 'swagger', 'twostep', 'twostep'],
        baroquepop: ['sway', 'conduct', 'spin', 'vogue', 'wave', 'plie', 'float', 'charleston',
                     'waltz', 'waltz', 'taichi', 'flamenco'],
        classical:  ['conduct', 'conduct', 'sway', 'vogue', 'plie', 'plie', 'float', 'tango',
                     'waltz', 'waltz', 'taichi', 'bonodori'],
        ambient:    ['sway', 'sway', 'wave', 'conduct', 'float', 'float', 'plie', 'snaps',
                     'taichi', 'taichi', 'bonodori', 'waltz', 'hula'],
        soundtrack: ['conduct', 'sway', 'armwave', 'jump', 'vogue', 'wave', 'float', 'tango', 'plie', 'lasso',
                     'taichi', 'waltz', 'powerstomp', 'flamenco', 'hula'],
    };
    const DEFAULT_MOVES = ['bounce', 'sway', 'clap', 'spin', 'point', 'armwave', 'hustle', 'snaps', 'runningman',
                           'waltz', 'fistpump', 'bodyroll', 'salsaon1', 'handsup'];

    /* Country → its own steps, mixed into the genre's pool in "Song's
       genre" mode (added, never replacing; a repeat weighs a step more).
       A country with no entry dances its genre's pool alone. */
    const MOVES_BY_COUNTRY = {
        mexico:            ['quebradita', 'jarabe', 'zapateado', 'jarabe', 'sonidera', 'sonidera', 'cumbiavela'],
        usa:               ['linedance', 'lasso', 'runningman', 'cabbagepatch', 'twostep', 'hula'],
        canada:            ['linedance', 'kick', 'polka', 'twostep'],
        japan:             ['parapara', 'bonodori', 'idol'],
        korea:             ['kpop', 'kpop', 'idol'],
        colombia:          ['cumbia', 'calena', 'salsa', 'calena', 'cumbiavela', 'cumbiavela', 'salsaspin', 'salsaarms', 'crossbody'],
        venezuela:         ['salsa', 'merengue', 'zapateado', 'salsaspin', 'merenguewalk', 'salsaarms'],
        panama:            ['cumbia', 'salsa', 'merengue', 'cumbiavela', 'salsaon1', 'merenguewalk'],
        honduras:          ['shimmy', 'samba', 'merengue', 'bachatahip', 'merenguewalk'],
        cuba:              ['son', 'son', 'salsa', 'shimmy', 'salsaon1', 'crossbody', 'salsaarms', 'suzyq'],
        dominicanrepublic: ['merengue', 'bachata', 'merengue', 'bachata', 'bachatahip', 'bachatawave', 'bachataturn',
                            'bachatastyle', 'merenguewalk'],
        puertorico:        ['pandero', 'pandero', 'salsa', 'bounce', 'salsaon1', 'salsaspin', 'suzyq', 'crossbody'],
        brazil:            ['samba', 'samba', 'bounce'],
        argentina:         ['tango', 'tango', 'zapateado'],
        uruguay:           ['tango', 'tango', 'samba'],
        chile:             ['lasso', 'zapateado', 'cumbia', 'cumbiavela'],
        bolivia:           ['kick', 'stomp', 'sidehop'],
        spain:             ['flamenco', 'flamenco', 'zapateado'],
        france:            ['kick', 'waltz', 'kick'],
        uk:                ['swagger', 'swagger', 'skank'],
        russia:            ['prisyadka', 'prisyadka', 'stomp'],
        ukraine:           ['prisyadka', 'prisyadka', 'sidehop'],
        poland:            ['polka', 'polka', 'waltz'],
        romania:           ['hora', 'hora', 'sidehop'],
        finland:           ['humppa', 'humppa', 'polka'],
        sweden:            ['humppa', 'polka', 'waltz'],
        iceland:           ['humppa', 'stomp', 'clap'],
        australia:         ['shuffle', 'powerstomp', 'shuffle'],
        newzealand:        ['powerstomp', 'powerstomp', 'stomp'],
    };
    const NO_TWERK = M.noTwerk;
    const MOVE_MIN = 4000, MOVE_SPREAD = 3500;   /* ms per move */
    const PLAY_ODDS = 0.25;   /* a move change picks 'play' when the song has instruments */

    const SVGNS = 'http://www.w3.org/2000/svg';

    const ALL_MOVES = ['bounce', 'sway', 'armwave', 'jump', 'spin', 'headbang', 'airguitar',
                       'robot', 'shuffle', 'salsa', 'conduct', 'twerk', 'twerklook', 'clap',
                       'point', 'twist', 'kick', 'floss', 'shimmy', 'pogo', 'wave', 'stomp',
                       'sidehop', 'vogue', 'cumbia', 'twerkside',
                       'runningman', 'charleston', 'glide', 'hustle', 'macarena', 'cabbagepatch',
                       'sprinkler', 'lasso', 'polka', 'skank', 'tango', 'zapateado', 'plie',
                       'float', 'idol', 'snaps',
                       'quebradita', 'jarabe', 'samba', 'merengue', 'bachata', 'flamenco', 'linedance',
                       'parapara', 'bonodori', 'kpop', 'prisyadka', 'hora', 'humppa', 'powerstomp',
                       'swagger', 'pandero', 'son', 'calena', 'windmill', 'fistpump', 'taichi', 'waltz',
                       'bodyroll',
                       'salsaon1', 'crossbody', 'salsaspin', 'suzyq', 'salsaarms',
                       'bachatahip', 'bachatawave', 'bachataturn', 'bachatastyle',
                       'merenguewalk', 'cumbiavela', 'sonidera',
                       'twostep', 'pony', 'lindy', 'handsup', 'hula'];
    /* the moves danced facing away: 'back' from behind, 'look' looking back
       'side' bent over, from the side (only mascots with a side view) */
    const VIEW = { twerk: 'back', twerklook: 'look', twerkside: 'side' };
    function tr(key) { return typeof t === 'function' ? t(key) : key; }

    /* ── Preferences (the 🕺 Mascots panel) ─────────────────── */
    /* mascot: 'random' or a name; dance: 'song' (the song's genre),
       'random' (any move) or a genre id. Kept in this browser only. */
    const PREF_KEY = 'mg_dancer';
    let prefs = { mascot: 'random', dance: 'song' };
    /* a saved mascot that left the cast (orchard, luna, ...) → random */
    try {
        const saved = JSON.parse(localStorage.getItem(PREF_KEY) || 'null');
        if (saved) {
            if (saved.mascot === 'random' || saved.mascot === 'all' || NAMES.includes(saved.mascot)) prefs.mascot = saved.mascot;
            if (saved.dance === 'song' || saved.dance === 'random' || MOVES[saved.dance]) prefs.dance = saved.dance;
        }
    } catch (e) {}
    function savePrefs() {
        try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch (e) {}
    }

    /* The moves a mascot picks from for a song of this genre (and, in
       "Song's genre" mode, its country's own steps on top) */
    function movesFor(name, genre, country) {
        let pool = prefs.dance === 'random' ? ALL_MOVES
                 : prefs.dance === 'song'   ? (MOVES[genre] || DEFAULT_MOVES)
                 : MOVES[prefs.dance];
        if (prefs.dance === 'song' && MOVES_BY_COUNTRY[country]) {
            const own = MOVES_BY_COUNTRY[country];
            pool = pool.concat(own, own);   /* about a third of the moves */
        }
        if (NO_TWERK[name]) pool = pool.filter(function (m) { return !VIEW[m]; });
        if (!M.side[name]) pool = pool.filter(function (m) { return VIEW[m] !== 'side'; });
        if (!M.look[name]) pool = pool.filter(function (m) { return VIEW[m] !== 'look'; });
        return pool.length ? pool : ['salsa', 'bounce', 'spin'];
    }

    function pickMove(pool, prev) {
        if (pool.length < 2) return pool[0];
        let m;
        do { m = pool[Math.floor(Math.random() * pool.length)]; } while (m === prev);
        return m;
    }

    /* One dancing figure: an element, its mascot and its moves. The stage
       has one; the Mascots panel has one per tile. */
    /* ctx = { country, genre } of the song (stage dancers only): national
       outfits, and the instruments it may play (panel tiles get none) */
    function Dancer(host, name, pool, cls, ctx) {
        this.name = name; this.pool = pool; this.move = ''; this.view = 'front'; this.timer = 0;
        this.ctx = ctx || null; this.inst = '';
        const I = window.MGInstruments;
        this.insts = ctx && I && I.forSong ? I.forSong(ctx.genre, ctx.country) : [];
        this.el = document.createElement('div');
        this.el.className = cls;
        this.base = cls;
        this.el.dataset.mascot = name;
        this.el.setAttribute('aria-hidden', 'true');
        this.svg = document.createElementNS(SVGNS, 'svg');
        this.variant = M.variant(name, this.ctx);   /* e.g. lola's hair, new every time */
        this.svg.setAttribute('viewBox', M.viewBox(null));
        this.svg.innerHTML = M.figure(name, 'front', this.variant);
        this.el.appendChild(this.svg);
        host.appendChild(this.el);
    }
    /* Each new move also gets its own little variation: a tempo between
       0.85× and 1.2×, and sometimes the dancer mirrored. A twerk is either
       quick (about as written) or slow (about half speed), and sometimes the
       dancer has company: one or two others twerking from behind beside
       them (any mascot that twerks), or, for lola from the side, a
       partner behind her. Company stays for back-to-back twerks, and nobody
       is mirrored while it's there, so the group holds its places. */
    function rollCompany(name, view, solo, ctx) {
        if (NO_TWERK[name] || solo) return null;   /* solo: the whole cast is on stage already */
        const CREW = NAMES.filter(function (n) { return !NO_TWERK[n]; });   /* only those who twerk */
        const r = Math.random();
        if (r < 0.3 && CREW.length) {
            const n = Math.random() < 0.6 ? 1 : 2, crew = [];
            for (let i = 0; i < n; i++) {
                const who = CREW[Math.floor(Math.random() * CREW.length)];
                /* no country for the company: nobody twerks in national dress */
                crew.push({ name: who, v: M.variant(who, null) });
            }
            return { crew: crew };
        }
        if (M.partnered && M.partnered[name] && view === 'side' && r < 0.6) return { partner: M.partnerVariant() };
        return null;
    }
    /* 'play': the special move where the dancer plays one of this.insts
       (MGInstruments), class "mv-play inst-<id>" (assets/css/instruments.css) */
    Dancer.prototype.setMove = function (move, plain) {
        /* national dress (a kimono, a hanbok, ...) is danced in, never twerked in */
        if (VIEW[move] && M.national && M.national(this.name, this.variant)) {
            const calm = this.pool.filter(function (m) { return !VIEW[m] && m !== move; });
            move = calm.length ? calm[Math.floor(Math.random() * calm.length)] : 'bounce';
        }
        const view = VIEW[move] || 'front';
        let company = null;
        if (!plain && view !== 'front') {
            company = (this.company && VIEW[this.move]) ? this.company : rollCompany(this.name, view, this.solo, this.ctx);
            if (company && company.partner && view !== 'side') company = null;   /* a partner only from the side */
        }
        const inst = move === 'play' && this.insts.length ? this.insts[Math.floor(Math.random() * this.insts.length)] : '';
        if (move === 'play' && !inst) move = 'bounce';
        /* now and then a dancer with outfits changes them between moves */
        let restyled = false;
        if (!plain && this.move && M.restyle && Math.random() < 0.2) {
            const nv = M.restyle(this.name, this.variant, view === 'front' ? this.ctx : null);   /* no national dress to twerk in */
            restyled = nv !== this.variant;
            this.variant = nv;
        }
        /* and, on its own, its expression (M.faces: positive ones only) */
        if (!plain && this.move && M.express && Math.random() < 0.35) {
            const nv = M.express(this.name, this.variant);
            if (nv !== this.variant) { restyled = true; this.variant = nv; }
        }
        if (restyled || view !== this.view || company !== this.company || inst !== this.inst) {   /* turn around, outfit, face, company or instrument changes */
            this.view = view;
            this.company = company;
            this.inst = inst;
            const opts = company || (inst ? { instrument: inst } : null);
            this.svg.setAttribute('viewBox', M.viewBox(company));
            this.svg.innerHTML = M.figure(this.name, view, this.variant, opts);
        }
        this.move = move;
        const mirror = !plain && !company && Math.random() < 0.4;
        this.el.className = this.base + ' mv-' + move + (inst ? ' inst-' + inst : '') + (mirror ? ' mirror' : '');
        let tempo = 0.85 + Math.random() * 0.35;
        if (VIEW[move]) tempo = Math.random() < 0.5 ? 0.9 + Math.random() * 0.25 : 0.4 + Math.random() * 0.15;
        this.el.style.setProperty('--tempo', plain ? 1 : tempo.toFixed(2));
        this.el.dataset.move = move;
        this.el.dataset.instrument = inst;
        this.el.dataset.rhythm = VIEW[move] ? (tempo < 0.7 ? 'slow' : 'quick') : '';
        this.el.dataset.company = company ? (company.crew ? 'crew' + company.crew.length : 'partner') : '';
    };
    Dancer.prototype.start = function () {
        const self = this;
        (function next() {
            /* a song with instruments: now and then the dancer plays one */
            const play = self.insts.length && self.move !== 'play' && Math.random() < PLAY_ODDS;
            self.setMove(play ? 'play' : pickMove(self.pool, self.move));
            self.timer = setTimeout(next, MOVE_MIN + Math.random() * MOVE_SPREAD);
        })();
    };
    Dancer.prototype.stop = function () {
        clearTimeout(this.timer);
        this.el.remove();
    };

    /* ── The stage dancers ──────────────────────────────────── */
    /* Two places on the lyrics stage:
         no lyrics  the stage is theirs: the chosen mascot (or, with
                    "All", the whole cast side by side, no company)
         lyrics     beside them: the chosen mascot on the right half,
                    behind the lyrics, which stay in front */
    let stageDancers = [], stageEl = null, stageBox = null, stageAlbum = null, stageSide = false, last = '';

    function pickMascot() {
        if (prefs.mascot !== 'random' && NAMES.includes(prefs.mascot)) return prefs.mascot;
        let name;
        do { name = NAMES[Math.floor(Math.random() * NAMES.length)]; } while (name === last && NAMES.length > 1);
        return name;
    }

    function show(album, stage, opts) {
        hide();
        if (!stage) return;
        const side = !!(opts && opts.side);
        stageEl = stage; stageAlbum = album; stageSide = side;
        const names = prefs.mascot === 'all' && !side ? NAMES.slice() : [pickMascot()];
        if (names.length === 1) last = names[0];
        stageBox = document.createElement('div');
        stageBox.className = 'dancer-stage' + (side ? ' beside' : '') + (names.length > 1 ? ' troupe' : '');
        stage.appendChild(stageBox);
        names.forEach(function (name) {
            const slot = document.createElement('div');
            slot.className = 'dancer-slot';
            stageBox.appendChild(slot);
            const ctx = { country: (album && album.country) || null, genre: (album && album.genre) || null };
            const d = new Dancer(slot, name, movesFor(name, ctx.genre, ctx.country), 'dancer', ctx);
            d.solo = names.length > 1;
            d.start();
            stageDancers.push(d);
        });
        stage.classList.add('has-dancer');
        stage.classList.toggle('dancer-beside', side);
    }

    function hide() {
        stageDancers.forEach(function (d) { d.stop(); });
        if (stageBox) stageBox.remove();
        if (stageEl) stageEl.classList.remove('has-dancer', 'dancer-beside');
        stageDancers = []; stageEl = null; stageBox = null; stageAlbum = null;
    }

    /* A preference changed: the dancers on stage follow it right away */
    function restage() {
        if (stageDancers.length && stageEl) show(stageAlbum, stageEl, { side: stageSide });
    }

    /* ── 🕺 Mascots panel ──────────────────────────────────── */
    /* Every mascot dancing in a tile; pick one (or Random) and how they
       dance: to the song's genre, random moves, or one genre's moves. The
       tiles only dance while the panel is open. */
    let panel = null, btn = null, tiles = [];

    function previewGenre() {
        return prefs.dance === 'song' || prefs.dance === 'random' ? null : prefs.dance;
    }

    function stopTiles() {
        tiles.forEach(function (d) { d.stop(); });
        tiles = [];
    }

    function renderPanel() {
        stopTiles();
        panel.innerHTML = '';

        const h1 = document.createElement('div');
        h1.className = 'mascot-head';
        h1.textContent = tr('Mascot');
        panel.appendChild(h1);
        const hint = document.createElement('div');
        hint.className = 'mascot-hint';
        hint.textContent = tr('Dances on the lyrics stage when a song has no lyrics, and beside the lyrics when it has them.');
        panel.appendChild(hint);

        const grid = document.createElement('div');
        grid.className = 'mascot-grid';
        panel.appendChild(grid);

        const rnd = document.createElement('button');
        rnd.className = 'mascot-tile mascot-random' + (prefs.mascot === 'random' ? ' active' : '');
        rnd.innerHTML = '<span class="mascot-dice" aria-hidden="true">🎲</span><span class="mascot-name"></span>';
        rnd.querySelector('.mascot-name').textContent = tr('Random');
        rnd.setAttribute('aria-pressed', prefs.mascot === 'random' ? 'true' : 'false');
        rnd.addEventListener('click', function () { choose('mascot', 'random'); });
        grid.appendChild(rnd);

        /* All: the whole cast at once (on a stage with no lyrics; beside
           lyrics there's room for one, picked at random) */
        const all = document.createElement('button');
        all.className = 'mascot-tile mascot-random mascot-all' + (prefs.mascot === 'all' ? ' active' : '');
        all.innerHTML = '<span class="mascot-dice" aria-hidden="true">👯</span><span class="mascot-name"></span>';
        all.querySelector('.mascot-name').textContent = tr('Everyone');
        all.title = tr('All mascots at once when a song has no lyrics');
        all.setAttribute('aria-pressed', prefs.mascot === 'all' ? 'true' : 'false');
        all.addEventListener('click', function () { choose('mascot', 'all'); });
        grid.appendChild(all);

        const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        NAMES.forEach(function (name) {
            const tile = document.createElement('button');
            tile.className = 'mascot-tile' + (prefs.mascot === name ? ' active' : '');
            tile.setAttribute('aria-pressed', prefs.mascot === name ? 'true' : 'false');
            tile.title = name;
            const box = document.createElement('span');
            box.className = 'mascot-box';
            tile.appendChild(box);
            const label = document.createElement('span');
            label.className = 'mascot-name';
            label.textContent = name;
            tile.appendChild(label);
            tile.addEventListener('click', function () { choose('mascot', name); });
            grid.appendChild(tile);
            const d = new Dancer(box, name, movesFor(name, previewGenre()), 'dancer dancer-mini');
            if (reduce) d.setMove('bounce', true); else d.start();
            tiles.push(d);
        });

        const h2 = document.createElement('div');
        h2.className = 'mascot-head';
        h2.textContent = tr('Dance');
        panel.appendChild(h2);
        const chips = document.createElement('div');
        chips.className = 'mascot-chips';
        panel.appendChild(chips);
        function chip(value, label) {
            const c = document.createElement('button');
            c.className = 'cs-btn filter-btn mascot-chip' + (prefs.dance === value ? ' active' : '');
            c.setAttribute('aria-pressed', prefs.dance === value ? 'true' : 'false');
            c.textContent = label;
            c.addEventListener('click', function () { choose('dance', value); });
            chips.appendChild(c);
        }
        chip('song', '🎵 ' + tr("Song's genre"));
        chip('random', '🎲 ' + tr('Random moves'));
        const genres = (typeof GENRES === 'object' && GENRES) ? GENRES : {};
        Object.keys(MOVES).forEach(function (id) {
            const g = genres[id];
            chip(id, g ? ((g.icon ? g.icon + ' ' : '') + g.name) : id.charAt(0).toUpperCase() + id.slice(1));
        });
    }

    function choose(key, value) {
        prefs[key] = value;
        savePrefs();
        renderPanel();
        restage();
    }

    /* Under the button, never over the navbar (on a phone the button sits
       in the navbar's ⋯ menu, which may be closed: then under the navbar) */
    function place() {
        const r = btn.getBoundingClientRect();
        const nav = document.getElementById('carinoNav');
        const navBottom = nav ? nav.getBoundingClientRect().bottom : 0;
        const shown = r.width > 0 && r.height > 0;
        panel.style.top = Math.max(navBottom + 6, shown ? r.bottom + 6 : 0) + 'px';
        const left = shown ? r.left : (window.innerWidth - panel.offsetWidth) / 2;
        panel.style.left = Math.max(8, Math.min(left, window.innerWidth - panel.offsetWidth - 8)) + 'px';
    }

    function setOpen(on) {
        if (!panel) return;
        if (on === panel.classList.contains('open')) return;
        if (on) {
            renderPanel();
            panel.classList.add('open');
            place();
        } else {
            panel.classList.remove('open');
            stopTiles();
        }
        btn.classList.toggle('menu-open', on);
        btn.setAttribute('aria-expanded', on ? 'true' : 'false');
    }

    function wirePanel() {
        btn = document.getElementById('mascotToggle');
        if (!btn) return;
        panel = document.createElement('div');
        panel.id = 'mascotPanel';
        panel.className = 'menu-panel mascot-panel';
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-label', tr('Mascots'));
        document.body.appendChild(panel);
        /* a choice re-renders the panel, detaching the clicked node: keep
           that click from reading as an outside click */
        panel.addEventListener('click', function (e) { e.stopPropagation(); });
        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            setOpen(!panel.classList.contains('open'));
        });
        document.addEventListener('click', function (e) {
            if (!panel.classList.contains('open')) return;
            if (panel.contains(e.target) || btn.contains(e.target)) return;
            setOpen(false);
        });
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setOpen(false); });
        window.addEventListener('resize', function () { setOpen(false); });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wirePanel);
    else wirePanel();

    window.MGDancer = { show: show, hide: hide, mascots: NAMES, moves: MOVES, countryMoves: MOVES_BY_COUNTRY,
                        allMoves: ALL_MOVES, movesFor: movesFor, figure: M.figure,
                        prefs: function () { return Object.assign({}, prefs); } };
})();
