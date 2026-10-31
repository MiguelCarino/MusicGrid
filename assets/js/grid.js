(function () {
    'use strict';

    const QUEUE_MAX = 10;

    /* ── State ──────────────────────────────────────────────── */
    /* filter: { type, value }
       type: 'all' | 'carino' | 'meme' | 'party' | 'country' | 'genre' | 'mood'
       value: id (party lists are keyed by country) */
    let filter      = { type: 'all', value: '' };
    let filterMenus = [];   // registry of dropdown menus (panels live in <body>)
    let scrollPaused   = false;
    let activeCell     = null;
    let scrollTimer    = null;
    let currentAlbum   = null; // album currently playing in the panel

    /* Autoplay: when on, keep playing songs after one ends even with an empty queue */
    let autoplayOn = false;
    try { autoplayOn = localStorage.getItem('mg_autoplay') === '1'; } catch (e) {}

    /* Shuffle (on by default): Next, Autoplay and the List walk a shuffled
       playlist of the current section, so no song repeats until every one
       has played. Off: Next picks any random song (repeats possible). */
    let shuffleOn = true;
    try { shuffleOn = localStorage.getItem('mg_shuffle') !== '0'; } catch (e) {}
    let playlist = { key: '', order: [], played: new Set() };

    /* ── Queue ──────────────────────────────────────────────── */
    let queue = [];

    /* ── Lyrics ─────────────────────────────────────────────── */
    let lyricsData   = [];
    let lyricsCueIdx = -1;
    let lyricsTimer  = null;
    let lyricsHidden = true;  /* user-toggled preference; off until turned on */
    try { lyricsHidden = localStorage.getItem('mg_lyrics') !== '1'; } catch (e) {}
    let lyricsAnim   = null;  /* running card resize animation */
    let lyricsOffset = 0;     /* seconds, per song; + shows lines sooner */
    let lyricsNotes  = false; /* no lyrics (missing or instrumental): music notes instead */
    let notesTimer   = null;  /* shows the notes if no lyrics arrive within NOTES_AFTER */

    /* ── YouTube IFrame API ─────────────────────────────────── */
    let ytPlayer    = null;
    let ytReady     = false;
    let pendingVideo = null;

    window.onYouTubeIframeAPIReady = function () {
        ytReady = true;
        if (pendingVideo) { createYTPlayer(pendingVideo); pendingVideo = null; }
    };

    /* Outside media loads only after a click or tap: the YouTube API is fetched
       the first time a song is played, never on page load, and a song restored
       from a shared link (?v=) waits in the card until Play is pressed. */
    let ytRequested  = false;
    let mediaDeferred = null;   /* album shown from the link but not loaded yet */
    function ensureYTApi() {
        if (ytRequested) return;
        ytRequested = true;
        const s = document.createElement('script');
        s.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(s);
    }

    /* Sound on/off (M or the dock button), remembered on this device. */
    let muted = false;
    try { muted = localStorage.getItem('mg_muted') === '1'; } catch (e) {}
    function applyMute() {
        if (ytPlayer && typeof ytPlayer.mute === 'function') { if (muted) ytPlayer.mute(); else ytPlayer.unMute(); }
        const b = document.getElementById('muteBtn');
        if (b) {
            b.textContent = muted ? t('Sound off') : t('Sound on');
            b.setAttribute('aria-pressed', muted ? 'true' : 'false');
        }
    }
    function toggleMute() {
        muted = !muted;
        try { localStorage.setItem('mg_muted', muted ? '1' : '0'); } catch (e) {}
        applyMute();
    }

    /* ── URL state ──────────────────────────────────────────── */
    /*
     * URL format: ?v=VIDEO_ID&q=ID1,ID2,ID3&cat=CATEGORY&s=SEARCH
     *   v   = currently playing video
     *   q   = comma-separated queue video IDs
     *   cat = active category filter
     *   s   = search query
     * Use replaceState so every song-change doesn't spam browser history.
     */
    /* Filter <-> URL encoding. '' = all · 'carino' · 'meme' · 'party:mexico' ·
       'country:japan' · 'genre:rock' · 'mood:chill'.
       A bare value (legacy ?cat=japan links) is read as a country. */
    function encodeFilter(f) {
        if (f.type === 'all')    return '';
        if (f.type === 'carino' || f.type === 'meme') return f.type;
        return f.type + ':' + f.value;
    }
    function decodeFilter(s) {
        if (!s)            return { type: 'all', value: '' };
        if (s === 'carino' || s === 'meme') return { type: s, value: '' };
        const i = s.indexOf(':');
        if (i < 0)         return { type: 'country', value: s };   // legacy
        const t = s.slice(0, i), v = s.slice(i + 1);
        if (['country', 'genre', 'mood', 'party'].includes(t)) return { type: t, value: v };
        return { type: 'all', value: '' };
    }

    function updateURL() {
        const p = new URLSearchParams();
        if (currentAlbum)            p.set('v', currentAlbum.url);
        if (queue.length)            p.set('q', queue.map(a => a.url).join(','));
        if (filter.type !== 'all')   p.set('cat', encodeFilter(filter));
        const qs = p.toString();
        history.replaceState(null, '', qs ? '?' + qs : location.pathname);
    }

    function albumByUrl(vid) {
        return albums.find(a => a.url === vid) || null;
    }

    /* Reads cat from URL into state — must run before buildFilters/populateGrid */
    function seedStateFromURL() {
        const cat = new URLSearchParams(location.search).get('cat');
        if (cat) filter = decodeFilter(cat);
    }

    /* Restores queue + playing video — run after grid is populated */
    function restoreFromURL() {
        const p    = new URLSearchParams(location.search);
        const qStr = p.get('q');
        if (qStr) {
            qStr.split(',').forEach(function (vid) {
                const a = albumByUrl(vid.trim());
                if (a && !queue.some(q => q.url === a.url) && queue.length < QUEUE_MAX) {
                    queue.push(a);
                }
            });
            renderQueue();
        }
        const vStr = p.get('v');
        if (vStr) {
            const a = albumByUrl(vStr.trim());
            if (a) openPanel(a, { defer: true });
        }
    }

    /* ── Helpers ────────────────────────────────────────────── */
    function shuffle(arr) {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    function visibleAlbums() {
        if (filter.type === 'carino')  return albums.filter(a => a.carino);
        if (filter.type === 'meme')    return albums.filter(a => a.meme);
        if (filter.type === 'party')   return albums.filter(a => (a.party || []).includes(filter.value));
        if (filter.type === 'country') return albums.filter(a => (a.country || '') === filter.value);
        if (filter.type === 'genre')   return albums.filter(a => (a.genre || '') === filter.value);
        if (filter.type === 'mood')    return albums.filter(a => (a.mood || '') === filter.value);
        return albums;
    }

    /* Registry lookups (window.COUNTRIES / window.GENRES in catalog.json) — fall back gracefully */
    function countryMeta(id) {
        const reg = (typeof COUNTRIES !== 'undefined' && COUNTRIES) ? COUNTRIES : {};
        return reg[id] || { name: id, flag: '🏳️' };
    }
    function genreMeta(id) {
        const reg = (typeof GENRES !== 'undefined' && GENRES) ? GENRES : {};
        return reg[id] || { name: id, icon: '🎵' };
    }
    function moodMeta(id) {
        const reg = (typeof MOODS !== 'undefined' && MOODS) ? MOODS : {};
        return reg[id] || { name: id, icon: '🎭' };
    }
    function countryLabel(id) { const m = countryMeta(id); return m.flag + ' ' + m.name; }
    function genreLabel(id)   { const m = genreMeta(id);   return m.icon + ' ' + m.name; }
    function moodLabel(id)    { const m = moodMeta(id);    return m.icon + ' ' + m.name; }
    function partyLabel(id)   { const m = countryMeta(id); return '🎉 ' + m.flag + ' ' + m.name; }

    /* Human label for the active filter (navbar diagnostics) */
    function filterLabel(f) {
        if (f.type === 'carino')  return '★ Carino';
        if (f.type === 'meme')    return t('Meme');
        if (f.type === 'party')   return partyLabel(f.value);
        if (f.type === 'country') return countryLabel(f.value);
        if (f.type === 'genre')   return genreLabel(f.value);
        if (f.type === 'mood')    return moodLabel(f.value);
        return t('All');
    }

    /* ── Grid ───────────────────────────────────────────────── */
    /* Cells carry their album; clicks are handled once on the grid (onGridClick)
       rather than by two listeners per cell — the wall holds thousands. */
    function addCell(grid, album) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.style.backgroundImage = `url(assets/covers/${album.image})`;
        if (album.tag) cell.title = album.tag;
        cell._album = album;

        /* Small + button to queue without interrupting current playback */
        const qBtn = document.createElement('button');
        qBtn.className = 'cell-queue-btn';
        qBtn.textContent = '+';
        qBtn.setAttribute('aria-label', t('Add to queue'));
        cell.appendChild(qBtn);

        grid.appendChild(cell);
    }

    function onGridClick(e) {
        const cell = e.target.closest('.cell');
        if (!cell) return;
        const qBtn = e.target.closest('.cell-queue-btn');
        if (qBtn) {
            addToQueue(cell._album, cell);
            qBtn.textContent = '✓';
            setTimeout(function () { qBtn.textContent = '+'; }, 1000);
            return;
        }
        /* Clicking the cover always plays immediately */
        setActiveCell(cell);
        openPanel(cell._album);
    }

    function cellsNeeded(grid) {
        /* Enough cells to fill ~3× the visible area so auto-scroll has room */
        const w    = grid.clientWidth  || window.innerWidth;
        const h    = grid.clientHeight || window.innerHeight;
        const size = 130; /* matches minmax(130px, …) in CSS */
        const cols = Math.max(1, Math.floor(w / size));
        const rows = Math.max(1, Math.ceil(h / size));
        return Math.max(200, cols * rows * 3);
    }

    function populateGrid(grid) {
        const pool = visibleAlbums();
        if (!pool.length) return;
        let s = shuffle(pool);
        const count = cellsNeeded(grid);
        for (let i = 0; i < count; i++) {
            if (i > 0 && i % s.length === 0) s = shuffle(pool);
            addCell(grid, s[i % s.length]);
        }
    }

    /* Keep adding cells until the grid is actually scrollable */
    function ensureScrollable(grid) {
        const pool = visibleAlbums();
        if (!pool.length) return;
        let guard = 0;
        while (grid.scrollHeight <= grid.clientHeight + 10 && guard++ < 10) {
            populateGrid(grid);
        }
    }

    /* Infinite scroll only ever appends, so a long session grew the wall
       without bound (~6,800 cells after an hour) and every relayout got slower
       — 5× worse in Firefox and WebKit than Chromium. Once the wall passes
       twice what fills the screen, whole rows that have scrolled out of view
       are dropped from the top and scrollTop moves up by the same amount, so
       nothing on screen shifts. */
    function trimGrid(grid) {
        const max  = cellsNeeded(grid) * 2;
        const over = grid.children.length - max;
        if (over <= 0) return;
        const cols = getComputedStyle(grid).gridTemplateColumns.split(' ').length;
        const rowH = grid.firstElementChild.offsetHeight;
        if (!cols || !rowH) return;
        /* keep a row of margin above the viewport */
        const rows = Math.min(Math.floor(over / cols), Math.floor(grid.scrollTop / rowH) - 1);
        if (rows <= 0) return;
        const n = rows * cols;
        const anchor = grid.children[n];
        const before = anchor.offsetTop;
        for (let i = 0; i < n; i++) {
            const c = grid.firstElementChild;
            if (c === activeCell) activeCell = null;
            c.remove();
        }
        grid.scrollTop -= before - anchor.offsetTop;
    }

    function refreshGrid(grid) {
        grid.innerHTML = '';
        clearActiveCell();
        populateGrid(grid);
        grid.scrollTop = 0;
    }

    /* ── Active cell ────────────────────────────────────────── */
    function setActiveCell(cell) {
        if (activeCell) activeCell.classList.remove('active');
        activeCell = cell;
        if (cell) cell.classList.add('active');
    }

    function clearActiveCell() { setActiveCell(null); }

    /* ── Auto-scroll ────────────────────────────────────────── */
    /* 20 px/s, stepped once per frame. Firefox rounds and WebKit truncates a
       fractional scrollTop (+1.4 moved 1px, +0.5 would never move), so the
       fraction is carried over and only whole pixels are written. rAF also
       stops on its own in background tabs. */
    const SCROLL_PX_PER_S = 20;

    /* Reduced motion is read live: under it the wall starts paused (Resume
       starts it), and switching the setting on mid-scroll pauses it. Help
       pauses it too. Either pause lifts by itself only if nothing else holds
       it, so a visitor's own Pause is never undone. */
    const motionMQ = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    let pausedByMotion = false, pausedByHelp = false;
    function setScrollPaused(p) {
        scrollPaused = !!p;
        const btn = document.getElementById('scrollToggle');
        if (!btn) return;
        btn.textContent = scrollPaused ? t('Resume') : t('Pause');
        btn.setAttribute('aria-pressed', scrollPaused ? 'true' : 'false');
        btn.title = scrollPaused ? t('Resume auto-scroll') : t('Pause auto-scroll');
    }
    function onMotionChange() {
        if (motionMQ.matches) {
            if (!scrollPaused) { pausedByMotion = true; setScrollPaused(true); }
        } else if (pausedByMotion) {
            pausedByMotion = false;
            if (!pausedByHelp) setScrollPaused(false);
        }
    }

    function startAutoScroll(grid) {
        if (scrollTimer) cancelAnimationFrame(scrollTimer);
        let last = performance.now(), carry = 0;
        scrollTimer = requestAnimationFrame(function step(now) {
            const dt = Math.min(now - last, 100);   /* no jump after a stall */
            last = now;
            if (!scrollPaused) {
                carry += SCROLL_PX_PER_S * dt / 1000;
                const px = Math.floor(carry);
                if (px) { grid.scrollTop += px; carry -= px; }
            }
            scrollTimer = requestAnimationFrame(step);
        });
    }

    /* ── Filters: ★ Carino · All quick pills + Country & Genre menus ── */

    /* Count songs per field value, return ids ordered by count then name */
    function countBy(key, metaFn) {
        const counts = {};
        albums.forEach(a => {
            /* party is a list (a song can be a staple in several countries) */
            [].concat(a[key] || []).forEach(v => { counts[v] = (counts[v] || 0) + 1; });
        });
        const ids = Object.keys(counts).sort((a, b) =>
            counts[b] - counts[a] || metaFn(a).name.localeCompare(metaFn(b).name));
        return { counts, ids };
    }

    /* Apply a filter from anywhere (pill or menu item) and resync the bar */
    function applyFilter(container, grid, type, value) {
        if (filter.type === type && filter.value === value) return;
        filter = { type: type, value: value };
        refreshGrid(grid);
        updateURL();
        syncFilterUI(container);
        renderSongList();
    }

    /* ── Song list ──────────────────────────────────────────── */
    /* Every song in the current section, A–Z, searchable (accent-insensitive,
       across tag, country, genre and mood). Hidden until ☰ List is pressed. */
    let listOpen = false;
    const fold = s => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const isPhone = () => window.matchMedia('(max-width: 640px)').matches;

    function listMatches(album, words) {
        if (!words.length) return true;
        const hay = fold([album.tag, countryMeta(album.country).name,
                          genreMeta(album.genre).name, moodMeta(album.mood).name].join(' '));
        return words.every(w => hay.includes(w));
    }

    function renderSongList() {
        if (!listOpen) return;
        const items = document.getElementById('songListItems');
        const words = fold(document.getElementById('songSearch').value).split(/\s+/).filter(Boolean);
        /* Shuffle on: the playlist, songs still to come first (in playing
           order), then this pass's played ones; off: A–Z */
        let pool;
        if (shuffleOn) {
            const pl = ensurePlaylist();
            const byUrl = new Map(visibleAlbums().map(a => [a.url, a]));
            const ordered = pl.order.map(u => byUrl.get(u)).filter(Boolean);
            pool = ordered.filter(a => !pl.played.has(a.url)).concat(ordered.filter(a => pl.played.has(a.url)));
        } else {
            pool = visibleAlbums().slice().sort((a, b) => (a.tag || '').localeCompare(b.tag || ''));
        }
        const shown = pool.filter(a => listMatches(a, words));

        document.getElementById('songListMeta').textContent = filterLabel(filter) +
            (shuffleOn ? ' · 🔀 ' + t('Shuffle') : '') + ' · ' +
            (shown.length === pool.length ? pool.length : shown.length + ' / ' + pool.length) + ' ' + t('songs');

        items.innerHTML = '';
        if (!shown.length) {
            const empty = document.createElement('div');
            empty.className = 'sl-empty';
            empty.textContent = t('No songs match');
            items.appendChild(empty);
            return;
        }
        const frag = document.createDocumentFragment();
        shown.forEach(function (album) {
            const row = document.createElement('div');
            row.className = 'sl-row';
            row.dataset.url = album.url;

            const img = document.createElement('img');
            img.src = `assets/covers/${album.image}`;
            img.alt = '';
            img.loading = 'lazy';

            const sep    = (album.tag || '').indexOf(' — ');
            const text   = document.createElement('div');
            text.className = 'sl-text';
            const title  = document.createElement('div');
            title.className = 'sl-title';
            title.textContent = sep >= 0 ? album.tag.slice(sep + 3) : album.tag;
            const artist = document.createElement('div');
            artist.className = 'sl-artist';
            artist.textContent = countryMeta(album.country).flag + ' ' + (sep >= 0 ? album.tag.slice(0, sep) : '');
            text.append(title, artist);

            const q = document.createElement('button');
            q.className = 'sl-queue';
            q.textContent = '+';
            q.setAttribute('aria-label', t('Add to queue'));
            q.addEventListener('click', function (e) {
                e.stopPropagation();
                addToQueue(album, img);
                q.textContent = '✓';
                q.classList.add('done');
            });

            row.append(img, text, q);
            row.addEventListener('click', function () { playFromList(album); });
            frag.appendChild(row);
        });
        items.appendChild(frag);
        markListPlaying();
    }

    function playFromList(album) {
        clearActiveCell();
        openPanel(album);
        if (isPhone()) setListOpen(false);   /* the list covers the player there */
    }

    function markListPlaying() {
        document.querySelectorAll('#songListItems .sl-row').forEach(function (r) {
            r.classList.toggle('playing', !!currentAlbum && r.dataset.url === currentAlbum.url);
        });
    }

    function setListOpen(open) {
        listOpen = open;
        const panel = document.getElementById('songList');
        const btn   = document.getElementById('listToggle');
        panel.classList.toggle('open', open);
        panel.setAttribute('aria-hidden', open ? 'false' : 'true');
        btn.classList.toggle('active', open);
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (!open) return;
        syncListBottom();
        renderSongList();
        const playing = document.querySelector('#songListItems .sl-row.playing');
        if (playing) playing.scrollIntoView({ block: 'center' });
        if (!isPhone()) document.getElementById('songSearch').focus();
    }

    /* Keep the list clear of the compact player card (bottom right): it ends
       just above it, or sits beside it when there's no room above for a useful
       list. The lyrics stage lives on the left, so it needs no room. */
    /* The list sits on the left (the player card, compact or the lyrics
       stage, is always on the right), clear of the dock at the bottom */
    function syncListBottom() {
        const list = document.getElementById('songList');
        const dock = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--dock-space')) || 0;
        list.classList.add('sl-left');
        document.documentElement.style.setProperty('--list-bottom', (18 + dock) + 'px');
    }

    /* Arrow keys pick a row, Enter plays it (or the first match), Escape closes */
    function onSearchKey(e) {
        const rows = [...document.querySelectorAll('#songListItems .sl-row')];
        let i = rows.findIndex(r => r.classList.contains('kbd'));
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            if (!rows.length) return;
            if (i >= 0) rows[i].classList.remove('kbd');
            i = e.key === 'ArrowDown' ? Math.min(rows.length - 1, i + 1) : Math.max(0, i - 1);
            rows[i].classList.add('kbd');
            rows[i].scrollIntoView({ block: 'nearest' });
        } else if (e.key === 'Enter') {
            const row = rows[i >= 0 ? i : 0];
            const album = row && albumByUrl(row.dataset.url);
            if (album) playFromList(album);
        } else if (e.key === 'Escape') {
            setListOpen(false);
        }
    }

    /* Close every open dropdown */
    function closeAllMenus() {
        filterMenus.forEach(function (m) {
            if (m.scrim) m.scrim.classList.remove('open');
            m.panel.classList.remove('open');
            m.btn.classList.remove('menu-open');
            m.btn.setAttribute('aria-expanded', 'false');
        });
    }

    /* Reflect the active filter across quick pills + every menu */
    function syncFilterUI(container) {
        container.querySelectorAll('.filter-btn[data-ftype]').forEach(function (el) {
            const on = el.dataset.ftype === filter.type &&
                       (el.dataset.fvalue || '') === (filter.value || '');
            el.classList.toggle('active', on);
        });
        filterMenus.forEach(function (m) {
            const picked = m.types ? m.types.includes(filter.type) : filter.type === m.type;
            m.btn.textContent = (m.types ? '📚 ' : '') + (picked ? m.labelFor(filter.value) : m.defLabel) + ' ▾';
            m.btn.classList.toggle('active', picked);
            m.panel.querySelectorAll('.menu-item').forEach(function (it) {
                it.classList.toggle('chosen', picked && (it.dataset.ftype || m.type) === filter.type &&
                                              (it.dataset.fvalue || '') === (filter.value || ''));
            });
        });
    }

    function buildFilters(container, grid) {
        container.innerHTML = '';
        /* Drop any panels a previous build left in <body> */
        filterMenus.forEach(function (m) {
            if (m.panel.parentNode) m.panel.parentNode.removeChild(m.panel);
            if (m.scrim && m.scrim.parentNode) m.scrim.parentNode.removeChild(m.scrim);
        });
        filterMenus = [];

        function quickPill(label, type, value, extraClass, title) {
            const btn = document.createElement('button');
            btn.className = 'cs-btn filter-btn' + (extraClass ? ' ' + extraClass : '');
            btn.textContent = label;
            btn.dataset.ftype = type;
            btn.dataset.fvalue = value || '';
            if (title) btn.title = title;
            btn.addEventListener('click', function () { closeAllMenus(); applyFilter(container, grid, type, value); });
            return btn;
        }

        /* The 📚 Lists popup: tabs + search over every specific list */
        function buildListsMenu(tabs) {
            const btn = document.createElement('button');
            btn.className = 'cs-btn filter-btn filter-menu-btn';
            btn.dataset.menu = 'lists';
            btn.setAttribute('aria-haspopup', 'true');
            btn.setAttribute('aria-expanded', 'false');

            /* A centred dialog over a dim scrim (clicking the scrim closes it) */
            const scrim = document.createElement('div');
            scrim.className = 'lists-scrim';
            scrim.addEventListener('click', closeAllMenus);
            document.body.appendChild(scrim);

            const panel = document.createElement('div');
            panel.className = 'menu-panel lists-panel';
            panel.setAttribute('role', 'dialog');
            panel.setAttribute('aria-modal', 'true');
            panel.setAttribute('aria-label', t('Lists'));

            const head = document.createElement('div');
            head.className = 'lists-head';
            head.innerHTML = '<span class="lists-title"></span><button class="lists-close" aria-label="Close">✕</button>';
            head.firstChild.textContent = '📚 ' + t('Lists');
            head.lastChild.setAttribute('aria-label', t('Close'));
            head.lastChild.addEventListener('click', closeAllMenus);
            panel.appendChild(head);

            const search = document.createElement('input');
            search.type = 'search';
            search.className = 'lists-search';
            search.placeholder = t('Search lists…');
            search.autocomplete = 'off';
            search.spellcheck = false;
            panel.appendChild(search);

            const tabBar = document.createElement('div');
            tabBar.className = 'lists-tabs';
            tabBar.setAttribute('role', 'tablist');
            panel.appendChild(tabBar);
            const body = document.createElement('div');
            body.className = 'lists-body';
            panel.appendChild(body);

            let tab = tabs[0].id;
            /* A tile: a 2×2 mosaic of the list's covers, its name, its count */
            function coversOf(it) {
                const hits = [];
                for (let i = 0; i < albums.length && hits.length < 4; i++) {
                    const a = albums[i];
                    const v = a[it.type];
                    if ((it.type === 'meme' ? a.meme : [].concat(v || []).includes(it.value)) &&
                        !hits.includes(a.image)) hits.push(a.image);   /* one per album */
                }
                return hits;
            }
            function itemBtn(it) {
                const b = document.createElement('button');
                b.className = 'menu-item lists-tile';
                b.dataset.ftype = it.type;
                b.dataset.fvalue = it.value;
                const mosaic = document.createElement('span');
                mosaic.className = 'lists-mosaic';
                mosaic.setAttribute('aria-hidden', 'true');
                coversOf(it).forEach(function (img) {
                    const im = document.createElement('img');
                    im.src = 'assets/covers/' + img;
                    im.alt = '';
                    im.loading = 'lazy';
                    mosaic.appendChild(im);
                });
                const name = document.createElement('span');
                name.className = 'menu-item-label';
                name.textContent = it.label;
                const count = document.createElement('span');
                count.className = 'menu-count';
                count.textContent = it.count + ' ' + t('songs');
                b.append(mosaic, name, count);
                b.classList.toggle('chosen', filter.type === it.type && (filter.value || '') === it.value);
                b.addEventListener('click', function () {
                    applyFilter(container, grid, it.type, it.value);
                    closeAllMenus();
                });
                return b;
            }
            function render() {
                const q = fold(search.value.trim());
                tabBar.style.display = q ? 'none' : '';
                tabBar.innerHTML = '';
                tabs.forEach(function (tb) {
                    const b = document.createElement('button');
                    b.className = 'lists-tab' + (tb.id === tab ? ' active' : '');
                    b.setAttribute('role', 'tab');
                    b.setAttribute('aria-selected', tb.id === tab ? 'true' : 'false');
                    b.textContent = tb.label;
                    b.addEventListener('click', function () { tab = tb.id; render(); });
                    tabBar.appendChild(b);
                });
                body.innerHTML = '';
                if (!q) {
                    tabs.find(tb => tb.id === tab).items.forEach(it => body.appendChild(itemBtn(it)));
                    return;
                }
                /* searching: matches from every tab, under their tab's name */
                let any = false;
                tabs.forEach(function (tb) {
                    const hits = tb.items.filter(it => fold(it.label).includes(q));
                    if (!hits.length) return;
                    any = true;
                    const h = document.createElement('div');
                    h.className = 'lists-group';
                    h.textContent = tb.label;
                    body.appendChild(h);
                    hits.forEach(it => body.appendChild(itemBtn(it)));
                });
                if (!any) {
                    const e = document.createElement('div');
                    e.className = 'lists-empty';
                    e.textContent = t('No lists match');
                    body.appendChild(e);
                }
            }
            /* a tab re-renders the panel, detaching the clicked node: keep that
               click from reading as an outside click (items close it themselves) */
            panel.addEventListener('click', function (e) { e.stopPropagation(); });
            search.addEventListener('input', render);
            search.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') { const first = body.querySelector('.menu-item'); if (first) first.click(); }
            });
            document.body.appendChild(panel);

            const rec = { type: 'lists', types: ['party', 'meme', 'country', 'genre', 'mood'],
                          scrim: scrim, btn: btn, panel: panel, defLabel: t('Lists'), labelFor: function () { return filterLabel(filter); } };
            filterMenus.push(rec);

            function open() {
                const wasOpen = panel.classList.contains('open');
                closeAllMenus();
                if (wasOpen) return;
                /* open on the tab of the list playing now */
                const cur = tabs.find(tb => tb.items.some(it => it.type === filter.type));
                if (cur) tab = cur.id;
                search.value = '';
                render();
                scrim.classList.add('open');
                panel.classList.add('open');
                btn.classList.add('menu-open');
                btn.setAttribute('aria-expanded', 'true');
                requestAnimationFrame(function () {
                    const chosen = body.querySelector('.menu-item.chosen');
                    if (chosen) chosen.scrollIntoView({ block: 'nearest' });
                    if (!window.matchMedia('(pointer: coarse)').matches) search.focus();
                });
            }
            btn.addEventListener('click', function (e) { e.stopPropagation(); open(); });
            return btn;
        }

        /* Outside-click / Escape / resize close — wired once on <body> */
        if (!document.body._menuWired) {
            document.body._menuWired = true;
            document.addEventListener('click', function (e) {
                if (e.target.closest && (e.target.closest('.menu-panel') || e.target.closest('.filter-menu-btn'))) return;
                closeAllMenus();
            });
            document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeAllMenus(); });
            window.addEventListener('resize', closeAllMenus);
        }

        /* Quick pills */
        if (albums.some(a => a.carino)) {
            container.appendChild(quickPill('★ Carino', 'carino', '', 'filter-carino', t("Miguel's personal list")));
        }
        container.appendChild(quickPill(t('All'), 'all', ''));

        /* 📚 Lists — one popup holding every specific list: the curated
           ones (🎉 Party per country, 😂 Meme) and the browse dimensions
           (Country, Genre, Mood), as tabs, with one search box across all
           of them. Only what exists in the data is shown. */
        const tabs = [];
        const curated = [];
        const party = countBy('party', countryMeta);
        party.ids.forEach(id => curated.push({ type: 'party', value: id, label: t('Party') + ' · ' + countryLabel(id), count: party.counts[id] }));
        const memeCount = albums.filter(a => a.meme).length;
        if (memeCount) curated.push({ type: 'meme', value: '', label: t('Meme'), count: memeCount });
        if (curated.length) tabs.push({ id: 'lists', label: t('Lists'), items: curated });
        [
            { type: 'country', label: t('Country'), metaFn: countryMeta, labelFn: countryLabel },
            { type: 'genre',   label: t('Genre'),   metaFn: genreMeta,   labelFn: genreLabel },
            { type: 'mood',    label: t('Mood'),    metaFn: moodMeta,    labelFn: moodLabel },
        ].forEach(function (d) {
            const data = countBy(d.type, d.metaFn);
            if (data.ids.length) tabs.push({ id: d.type, label: d.label,
                items: data.ids.map(id => ({ type: d.type, value: id, label: d.labelFn(id), count: data.counts[id] })) });
        });
        if (tabs.length) container.appendChild(buildListsMenu(tabs));

        syncFilterUI(container);
    }

    /* ── Queue ──────────────────────────────────────────────── */
    function syncQueueBtn() {
        /* Re-evaluates the "+ Queue / ✓ In Queue" button for the current album. */
        const btn = document.getElementById('queueAddBtn');
        if (!btn || !currentAlbum) return;
        const inQ = queue.some(a => a.url === currentAlbum.url);
        btn.textContent = inQ ? t('✓ In Queue') : t('+ Add to queue');
        btn.disabled    = inQ;
    }

    /* from: the element the song was queued from — its cover flies to the queue */
    function addToQueue(album, from) {
        if (queue.length >= QUEUE_MAX) return false;
        if (queue.some(a => a.url === album.url)) return false;
        queue.push(album);
        renderQueue();
        syncQueueBtn();
        updateURL();
        flyToQueue(album, from);
        return true;
    }

    /* A copy of the cover arcs from where it was queued into its new queue slot,
       which pops in as it lands. Two layers make the arc: the outer one eases
       out sideways while the inner one eases in vertically. */
    function flyToQueue(album, from) {
        const bar    = document.getElementById('queueBar');
        const target = bar.querySelector(`.queue-item[data-url="${CSS.escape(album.url)}"]`);
        if (!from || !target || !target.animate ||
            window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        bar.scrollLeft = bar.scrollWidth;                 /* newest slot in view */

        const a = from.getBoundingClientRect(), b = target.getBoundingClientRect();
        if (!a.width || !b.width) return;
        const size = Math.min(a.width, a.height);         /* square, centered on the source */
        const x0 = a.left + (a.width - size) / 2, y0 = a.top + (a.height - size) / 2;
        const dx = b.left + b.width / 2 - (x0 + size / 2);
        const dy = b.top + b.height / 2 - (y0 + size / 2);
        const scale = b.width / size;

        const ghost = document.createElement('div');
        ghost.className = 'queue-fly';
        Object.assign(ghost.style, { left: x0 + 'px', top: y0 + 'px', width: size + 'px', height: size + 'px' });
        const cover = document.createElement('div');
        cover.style.backgroundImage = `url(assets/covers/${album.image})`;
        ghost.appendChild(cover);
        document.body.appendChild(ghost);

        target.style.opacity = '0';
        const ms = 680;
        ghost.animate([{ transform: 'translateX(0)' }, { transform: `translateX(${dx}px)` }],
                      { duration: ms, easing: 'cubic-bezier(0.25, 0.8, 0.4, 1)', fill: 'forwards' });
        const fly = cover.animate([
            { transform: 'translateY(0) scale(1) rotate(0deg)', opacity: 1 },
            { transform: `translateY(${dy * 0.35}px) scale(${(1 + scale) / 2}) rotate(-8deg)`, opacity: 1, offset: 0.5 },
            { transform: `translateY(${dy}px) scale(${scale}) rotate(0deg)`, opacity: 0.9 },
        ], { duration: ms, easing: 'cubic-bezier(0.55, 0, 0.85, 0.5)', fill: 'forwards' });
        fly.onfinish = fly.oncancel = function () {
            ghost.remove();
            target.style.opacity = '';
            target.animate([{ transform: 'scale(0.6)' }, { transform: 'scale(1.18)' }, { transform: 'scale(1)' }],
                           { duration: 320, easing: 'ease-out' });
        };
    }

    function renderQueue() {
        const bar = document.getElementById('queueBar');
        bar.innerHTML = '';

        bar.title = t('Queue');
        if (!queue.length) {
            bar.classList.remove('has-items');
            return;
        }

        bar.classList.add('has-items');

        queue.forEach(function (album, idx) {
            const item = document.createElement('div');
            item.className = 'queue-item';
            item.dataset.url = album.url;
            item.style.backgroundImage = `url(assets/covers/${album.image})`;
            if (album.tag) item.title = album.tag;
            if (currentAlbum && currentAlbum.url === album.url) item.classList.add('playing');

            item.addEventListener('click', function (e) {
                if (e.target.classList.contains('queue-remove')) return;
                clearActiveCell();
                openPanel(album);
            });

            const rm = document.createElement('button');
            rm.className = 'queue-remove';
            rm.setAttribute('aria-label', t('Remove from queue'));
            rm.textContent = '×';
            rm.addEventListener('click', function (e) {
                e.stopPropagation();
                queue.splice(idx, 1);
                renderQueue();
                syncQueueBtn(); /* reset "✓ In Queue" button if needed */
                updateURL();
            });

            item.appendChild(rm);
            bar.appendChild(item);
        });
    }

    /* ── LRC parser ─────────────────────────────────────────── */
    /*
     * Source: the song's LRCLIB record (catalog field "lrclib"), fetched from
     * lrclib.net at play time. Lyrics are copyrighted, so the site never hosts
     * them; the catalog keeps only the record id, which pins the exact version.
     *
     * Format:
     *   [MM:SS.xx]Original | Translation
     *   [MM:SS.xx]Line without translation
     * Hundredths (xx) or milliseconds (xxx) accepted.
     */
    function parseLRC(text) {
        const re   = /^\[(\d{1,2}):(\d{2})\.(\d{2,3})\](.*)$/;
        const cues = [];
        /* standard [offset:±ms] tag: + shows every line that much sooner */
        const om   = text.match(/^\[offset:\s*([+-]?\d+)\s*\]/mi);
        const shift = om ? parseInt(om[1], 10) / 1000 : 0;
        text.split('\n').forEach(function (line) {
            const m = line.match(re);
            if (!m) return;
            const time = parseInt(m[1], 10) * 60 + parseInt(m[2], 10)
                + parseInt(m[3], 10) / (m[3].length === 2 ? 100 : 1000);
            const content = m[4].trim();
            const sep     = content.indexOf(' | ');
            cues.push({
                time:        time - shift,
                original:    sep >= 0 ? content.slice(0, sep).trim() : content,
                translation: sep >= 0 ? content.slice(sep + 3).trim() : '',
            });
        });
        return cues.sort((a, b) => a.time - b.time);
    }

    /* ── Lyrics overlay ─────────────────────────────────────── */
    function updateLyricsToggle() {
        const btn = document.getElementById('lyricsToggle');
        if (!btn) return;
        const hasLyrics = lyricsData.length > 0 || lyricsNotes;
        btn.style.display = hasLyrics ? '' : 'none';
        if (hasLyrics) {
            btn.textContent = t('Lyrics');
            btn.classList.toggle('active', !lyricsHidden);
            btn.setAttribute('aria-pressed', lyricsHidden ? 'false' : 'true');
        }
    }

    function buildLyricsPanel(cues) {
        lyricsData   = cues;
        lyricsCueIdx = -1;
        lyricsNotes  = false;   /* lyrics that arrived late replace the notes */
        /* the mascot moves aside: it dances on the right, behind the lyrics */
        if (window.MGDancer) MGDancer.show(currentAlbum, document.getElementById('lyricsSection'), { side: true });
        document.getElementById('lyricsSection').classList.remove('no-lyrics', 'gap');

        const container = document.getElementById('lyricsContainer');
        container.innerHTML = '';

        cues.forEach(function (cue, idx) {
            const line = document.createElement('div');
            line.className  = 'lyric-line';
            line.dataset.idx = idx;
            line.addEventListener('click', function () { seekToCue(idx); });

            const orig = document.createElement('div');
            orig.className   = 'lyric-original';
            orig.textContent = cue.original;
            line.appendChild(orig);

            if (cue.translation) {
                const tr = document.createElement('div');
                tr.className   = 'lyric-translation';
                tr.textContent = cue.translation;
                line.appendChild(tr);
            }

            container.appendChild(line);
        });

        updateLyricsToggle();
        setLyricsMode(!lyricsHidden);
    }

    /* Drop the current song's lyrics. The card keeps its shape so a song
       change between two songs with lyrics doesn't collapse and regrow it. */
    function clearLyrics() {
        lyricsData   = [];
        lyricsCueIdx = -1;
        lyricsNotes  = false;
        clearTimeout(notesTimer);
        if (window.MGDancer) MGDancer.hide();
        stopLyricsSync();
        document.getElementById('lyricsContainer').innerHTML = '';
        document.getElementById('lyricsSection').classList.remove('no-lyrics', 'gap');
        updateLyricsToggle();
    }

    /* Music notes drift over the lyrics stage whenever nothing has been sung
       for NOTES_AFTER seconds: a song with no lyrics (none found within that
       time, or instrumental), and a long intro, break or outro in one that
       has them. They give way NOTES_LEAD seconds before the next line. */
    const NOTES_AFTER = 3, NOTES_LEAD = 1;
    const NOTE_SVG = [
        '<svg viewBox="0 0 24 24"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
        '<svg viewBox="0 0 24 24"><circle cx="8" cy="18" r="4"/><path d="M12 18V2l7 4"/></svg>',
    ];
    function ensureNotes() {
        const section = document.getElementById('lyricsSection');
        if (section.querySelector('.lyric-notes')) return;
        const notes = document.createElement('div');
        notes.className = 'lyric-notes';
        notes.setAttribute('aria-hidden', 'true');
        for (let i = 0; i < 5; i++) {
            const n = document.createElement('span');
            n.innerHTML = NOTE_SVG[i % 2];
            n.style.setProperty('--i', i);
            notes.appendChild(n);
        }
        section.appendChild(notes);
    }

    function showLyricsNotes() {
        lyricsNotes = true;
        ensureNotes();
        /* no lyrics for this song: a mascot dances to its genre instead */
        if (window.MGDancer) MGDancer.show(currentAlbum, document.getElementById('lyricsSection'));
        document.getElementById('lyricsSection').classList.add('no-lyrics', 'gap');
        updateLyricsToggle();
        setLyricsMode(!lyricsHidden);
    }

    /* Blank lines (LRC end markers) and "(Instrumental)"-style lines are gaps */
    const GAP_LINE = /^[\s♪♫…・.\-–—]*$|^[(（[]\s*(instrumental|interlude|intro|outro|solo|music|break|間奏)[^)）\]]*[)）\]]$/i;
    function updateGap(t) {
        const cur  = lyricsData[lyricsCueIdx];
        if (cur && !GAP_LINE.test(cur.original)) { setGap(false); return; }
        const since = cur ? cur.time : 0;
        const next  = lyricsData[lyricsCueIdx + 1];
        setGap(t - since >= NOTES_AFTER && (!next || next.time - t >= NOTES_LEAD));
    }
    function setGap(on) {
        const section = document.getElementById('lyricsSection');
        if (section.classList.contains('gap') === on) return;
        if (on) ensureNotes();
        section.classList.toggle('gap', on);
    }

    /* Switch the player card between compact and the lyrics stage (lyrics on
       top, info merged below). The size change is animated FLIP-style: measure,
       switch the class, measure again, then animate between the two boxes. */
    function setLyricsMode(on) {
        const bar = document.getElementById('videoInfoBar');
        if (bar.classList.contains('lyrics-on') === on) return;

        const animate = bar.classList.contains('show') && bar.animate &&
            !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const first = bar.getBoundingClientRect();
        if (lyricsAnim) { lyricsAnim.cancel(); lyricsAnim = null; }
        bar.classList.toggle('lyrics-on', on);
        syncListBottom();
        if (!animate) return;

        /* the stage sits on the left, the compact card on the right: slide
           across (transform) while the box resizes */
        const last = bar.getBoundingClientRect();
        if (first.width === last.width && first.height === last.height &&
            first.left === last.left) return;
        const dx = first.left - last.left, dy = first.top - last.top;
        const ease = 'cubic-bezier(0.22, 1, 0.36, 1)';
        lyricsAnim = bar.animate([
            { width: first.width + 'px', height: first.height + 'px', overflow: 'hidden',
              transform: `translate(${dx}px, ${dy}px)` },
            { width: last.width + 'px',  height: last.height + 'px',  overflow: 'hidden',
              transform: 'none' },
        ], { duration: 560, easing: ease });
        lyricsAnim.onfinish = function () {
            lyricsAnim = null;
            if (on && lyricsCueIdx >= 0) highlightLine(lyricsCueIdx); /* re-center */
        };
        /* the content reflows at once — fade it in behind the moving edges */
        const fade = [{ opacity: 0 }, { opacity: 1 }];
        if (on) document.getElementById('lyricsSection')
            .animate(fade, { duration: 360, delay: 160, easing: 'ease', fill: 'backwards' });
        bar.querySelector('.vib-info')
            .animate(fade, { duration: 320, delay: 120, easing: 'ease', fill: 'backwards' });
    }

    /* Scrolls only the lyrics box: scrollIntoView also walks every scrollable
       ancestor, including the overflow:hidden player card */
    function highlightLine(idx) {
        const container = document.getElementById('lyricsContainer');
        const prev = container.querySelector('.lyric-line.current');
        if (prev) prev.classList.remove('current');
        const el = idx >= 0 ? container.children[idx] : null;
        if (!el || !el.classList.contains('lyric-line')) return;
        el.classList.add('current');
        const box = container.getBoundingClientRect(), r = el.getBoundingClientRect();
        container.scrollTo({
            top: container.scrollTop + r.top - box.top - (box.height - r.height) / 2,
            behavior: 'smooth',
        });
    }

    /* ── Lyrics sync ────────────────────────────────────────── */
    function startLyricsSync() {
        stopLyricsSync();
        if (!lyricsData.length) return;
        lyricsTimer = setInterval(syncLyricsNow, 100);
    }

    /* Jump the song to a lyric line and keep playing from there. The line's
       time is in lyrics time, so the song's offset is taken back off; a hair
       past the cue so the sync lands on this line, not the one before. */
    function seekToCue(idx) {
        const cue = lyricsData[idx];
        if (!cue || !ytPlayer || typeof ytPlayer.seekTo !== 'function') return;
        ytPlayer.seekTo(Math.max(0, cue.time - lyricsOffset + 0.05), true);
        if (typeof ytPlayer.playVideo === 'function') ytPlayer.playVideo();
        lyricsCueIdx = idx;
        highlightLine(idx);
    }

    /* Highlight the line for the player's current time (+ the song's offset) */
    function syncLyricsNow() {
        if (!lyricsData.length) return;
        if (!ytPlayer || typeof ytPlayer.getCurrentTime !== 'function') return;
        const t = ytPlayer.getCurrentTime() + lyricsOffset;
        let idx = -1;
        for (let i = 0; i < lyricsData.length; i++) {
            if (lyricsData[i].time <= t) idx = i; else break;
        }
        if (idx !== lyricsCueIdx) {
            lyricsCueIdx = idx;
            highlightLine(idx);
        }
        updateGap(t);
    }

    /* Lyrics timing, remembered per song (uploads of the same song drift
       differently). Step 0.25s, ±10s. */
    const LYRICS_OFFSET_STEP = 0.25, LYRICS_OFFSET_MAX = 10;
    function readOffsets() {
        try { return JSON.parse(localStorage.getItem('mg_lyrics_offsets') || '{}') || {}; }
        catch (e) { return {}; }
    }
    function setLyricsOffset(sec, save) {
        sec = Math.round(Math.min(LYRICS_OFFSET_MAX, Math.max(-LYRICS_OFFSET_MAX, +sec || 0)) * 100) / 100;
        lyricsOffset = sec;
        document.getElementById('lyricsOffsetVal').textContent =
            (sec > 0 ? '+' : sec < 0 ? '−' : '±') + Math.abs(sec).toFixed(2) + 's';
        document.getElementById('lyricsOffset').classList.toggle('shifted', sec !== 0);
        document.getElementById('lyricsLater').disabled  = sec <= -LYRICS_OFFSET_MAX;
        document.getElementById('lyricsSooner').disabled = sec >= LYRICS_OFFSET_MAX;
        if (save && currentAlbum) {
            const all = readOffsets();
            if (sec) all[currentAlbum.url] = sec; else delete all[currentAlbum.url];
            try { localStorage.setItem('mg_lyrics_offsets', JSON.stringify(all)); } catch (e) {}
        }
        syncLyricsNow();   /* follow at once, even while paused */
    }

    function stopLyricsSync() {
        if (lyricsTimer) { clearInterval(lyricsTimer); lyricsTimer = null; }
    }

    /* ── Queue auto-advance ─────────────────────────────────── */
    function playNextInQueue() {
        if (!queue.length) return;
        const next = queue.shift();
        renderQueue();
        updateURL();
        clearActiveCell();
        openPanel(next);
    }

    /* The shuffled playlist of the current section; rebuilt when the
       section changes. played holds what this pass has already played. */
    function sectionKey() { return filter.type + ':' + (filter.value || ''); }
    function ensurePlaylist() {
        const key = sectionKey();
        if (playlist.key === key && playlist.order.length) return playlist;
        const pool = visibleAlbums();
        playlist = { key: key, order: shuffle(pool).map(a => a.url), played: new Set() };
        if (currentAlbum && playlist.order.includes(currentAlbum.url)) {
            /* the song playing now opens the playlist */
            playlist.order = [currentAlbum.url].concat(playlist.order.filter(u => u !== currentAlbum.url));
            playlist.played.add(currentAlbum.url);
        }
        return playlist;
    }
    function markPlayed(album) {
        if (playlist.key === sectionKey() && playlist.order.includes(album.url)) playlist.played.add(album.url);
    }
    /* The next song of the playlist not yet played; a fresh shuffle once
       the whole section has played */
    function nextFromPlaylist() {
        const pl = ensurePlaylist();
        let url = pl.order.find(u => !pl.played.has(u) && (!currentAlbum || u !== currentAlbum.url));
        if (!url) {
            const pool = visibleAlbums();
            if (!pool.length) return null;
            let order = shuffle(pool).map(a => a.url);
            if (currentAlbum && order.length > 1 && order[0] === currentAlbum.url) order.push(order.shift());
            playlist = { key: pl.key, order: order, played: new Set() };
            url = order.find(u => !currentAlbum || u !== currentAlbum.url) || order[0];
        }
        return albums.find(a => a.url === url) || null;
    }

    /* The next song of the section: the playlist's when shuffling, else any
       random one other than the one playing */
    function playRandom() {
        let next;
        if (shuffleOn) next = nextFromPlaylist();
        else {
            const pool = visibleAlbums().filter(a => !currentAlbum || a.url !== currentAlbum.url);
            next = pool.length ? pool[Math.floor(Math.random() * pool.length)] : (currentAlbum || null);
        }
        if (next) { clearActiveCell(); openPanel(next); }
    }

    /* Called when a song ends: queue first, else autoplay a fresh random song */
    function advanceAfterEnd() {
        if (queue.length) { playNextInQueue(); return; }
        if (autoplayOn) playRandom();
    }

    /* ── Transport: previous · play/pause · next ────────────── */
    /* Songs played before the current one (most recent last). Previous
       restarts a song that's more than 3 s in, else steps back here — and
       puts the current song at the front of the queue so Next returns to it. */
    const HISTORY_MAX = 50;
    let playHistory = [];

    function playPrevious() {
        const t0 = ytPlayer && typeof ytPlayer.getCurrentTime === 'function' ? ytPlayer.getCurrentTime() : 0;
        if (t0 > 3 || !playHistory.length) {
            if (ytPlayer && typeof ytPlayer.seekTo === 'function') ytPlayer.seekTo(0, true);
            return;
        }
        const prev = playHistory.pop();
        if (currentAlbum && !queue.some(a => a.url === currentAlbum.url)) {
            queue.unshift(currentAlbum);
            if (queue.length > QUEUE_MAX) queue.pop();
            renderQueue();
        }
        clearActiveCell();
        openPanel(prev, { fromHistory: true });
    }

    function playNext() {
        if (queue.length) playNextInQueue();
        else playRandom();
    }

    function togglePlay() {
        if (!currentAlbum) { playRandom(); return; }
        if (mediaDeferred === currentAlbum) { startMedia(currentAlbum); return; }
        if (!ytPlayer || typeof ytPlayer.getPlayerState !== 'function') return;
        if (ytPlayer.getPlayerState() === YT.PlayerState.PLAYING) ytPlayer.pauseVideo();
        else ytPlayer.playVideo();
    }

    /* Play/pause shows the player's real state; previous needs a song */
    function syncTransport(playing) {
        const btn = document.getElementById('playBtn');
        btn.classList.toggle('is-playing', !!playing);
        document.getElementById('lyricsSection').classList.toggle('playing', !!playing);
        const label = playing ? t('Pause') : t('Play');
        btn.title = label;
        btn.setAttribute('aria-label', label);
        document.getElementById('prevBtn').disabled = !currentAlbum;
    }

    /* ── YouTube player ─────────────────────────────────────── */
    function createYTPlayer(videoId) {
        const slot = document.getElementById('ytPlayerSlot');
        slot.innerHTML = '';
        const div = document.createElement('div');
        slot.appendChild(div);

        ytPlayer = new YT.Player(div, {
            /* privacy-enhanced mode: no YouTube cookies until the visitor interacts */
            host: 'https://www.youtube-nocookie.com',
            videoId,
            width: 640, height: 360,
            playerVars: { autoplay: 1, rel: 0, modestbranding: 1 },
            events: {
                onReady: function () { applyMute(); syncLyricsNow(); },   /* a saved offset can land on a line before play */
                onStateChange: function (e) {
                    syncTransport(e.data === YT.PlayerState.PLAYING || e.data === YT.PlayerState.BUFFERING);
                    if (e.data === YT.PlayerState.PLAYING) {
                        startLyricsSync();
                    } else if (e.data === YT.PlayerState.ENDED) {
                        stopLyricsSync();
                        advanceAfterEnd();
                    } else {
                        stopLyricsSync();
                        syncLyricsNow();   /* paused/cued: show where it stopped */
                    }
                }
            }
        });
    }

    function loadVideo(videoId) {
        ensureYTApi();
        if (ytPlayer && typeof ytPlayer.loadVideoById === 'function') {
            ytPlayer.loadVideoById(videoId);
        } else if (ytReady) {
            createYTPlayer(videoId);
        } else {
            pendingVideo = videoId;
        }
    }

    /* ── Info panel ─────────────────────────────────────────── */
    function openPanel(album, opts) {
        if (currentAlbum && currentAlbum.url !== album.url && !(opts && opts.fromHistory)) {
            playHistory.push(currentAlbum);
            if (playHistory.length > HISTORY_MAX) playHistory.shift();
        }
        currentAlbum = album;
        markPlayed(album);
        updateURL();

        clearLyrics();
        setLyricsOffset(readOffsets()[album.url] || 0, false);

        mediaDeferred = (opts && opts.defer) ? album : null;
        if (!mediaDeferred) loadLyrics(album);

        /* Title comes straight from the catalog tag — no API key, no quota. */
        displayVideoInfo(album.tag || '', album);
        renderQueue();
    }

    /* Lyrics for the song now in the card: fetched from LRCLIB, on play only */
    function loadLyrics(album) {
        /* No lyrics within NOTES_AFTER seconds (none exist, or a slow
           network) → the notes; lyrics that turn up later still replace them */
        notesTimer = setTimeout(function () {
            if (currentAlbum === album && !lyricsData.length) showLyricsNotes();
        }, NOTES_AFTER * 1000);

        /* Lyrics come from LRCLIB by record id; a song without one shows the notes */
        if (album.lrclib) fetchLyrics(album)
            .then(function (text) {
                if (currentAlbum !== album) return; /* a newer song took over */
                const cues = parseLRC(text);
                if (!cues.length) throw 0;
                clearTimeout(notesTimer);
                buildLyricsPanel(cues);
                syncLyricsNow();   /* the song's saved offset may already land on a line */
                if (ytPlayer && typeof ytPlayer.getPlayerState === 'function' &&
                    ytPlayer.getPlayerState() === YT.PlayerState.PLAYING) {
                    startLyricsSync();
                }
            })
            .catch(function () {});   /* no lyrics: notesTimer brings the notes */
    }

    /* ── Lyrics fetch: per-visitor cache + retry ─────────────── */
    /*
     * Each visitor keeps the lyrics they've already played in their own
     * localStorage (like the browser cache: a private copy, never sent
     * anywhere), so a song plays with lyrics even while LRCLIB is down.
     * LRCLIB often answers 503 "busy"; that and network errors are retried
     * a few times, giving up as soon as another song takes over the card.
     */
    const LRC_CACHE_PREFIX = 'mg_lrc_';
    const LRC_CACHE_INDEX  = 'mg_lrc_index';   /* ids, most recently used last */
    const LRC_CACHE_MAX    = 150;
    const LRC_RETRY_DELAYS = [1500, 4000, 9000];

    function lrcCacheGet(id) {
        try {
            const text = localStorage.getItem(LRC_CACHE_PREFIX + id);
            if (text) lrcCacheTouch(id);
            return text;
        } catch (e) { return null; }
    }

    function lrcCacheTouch(id) {
        try {
            let ids = JSON.parse(localStorage.getItem(LRC_CACHE_INDEX) || '[]');
            ids = ids.filter(function (x) { return x !== id; });
            ids.push(id);
            while (ids.length > LRC_CACHE_MAX) localStorage.removeItem(LRC_CACHE_PREFIX + ids.shift());
            localStorage.setItem(LRC_CACHE_INDEX, JSON.stringify(ids));
        } catch (e) { /* storage blocked or full: just don't cache */ }
    }

    function lrcCachePut(id, text) {
        try {
            localStorage.setItem(LRC_CACHE_PREFIX + id, text);
            lrcCacheTouch(id);
        } catch (e) { /* storage blocked or full: just don't cache */ }
    }

    function fetchLyrics(album) {
        const id = String(album.lrclib);
        const cached = lrcCacheGet(id);
        if (cached) return Promise.resolve(cached);

        function attempt(n) {
            return fetch('https://lrclib.net/api/get/' + encodeURIComponent(id))
                .then(function (r) {
                    if (r.ok) return r.json();
                    /* busy / rate-limited / server error → worth another try */
                    throw { retry: r.status === 429 || r.status >= 500 };
                }, function () { throw { retry: true }; })   /* network error */
                .then(function (rec) {
                    const text = (rec && rec.syncedLyrics) || '';
                    if (text) lrcCachePut(id, text);
                    return text;
                }, function (err) {
                    if (!err || !err.retry || n >= LRC_RETRY_DELAYS.length) throw 0;
                    return new Promise(function (resolve) {
                        setTimeout(resolve, LRC_RETRY_DELAYS[n]);
                    }).then(function () {
                        if (currentAlbum !== album) throw 0;   /* moved on: stop */
                        return attempt(n + 1);
                    });
                });
        }
        return attempt(0);
    }

    /* A song the card was showing from a link starts here, on Play */
    function startMedia(album) {
        mediaDeferred = null;
        loadLyrics(album);
        loadVideo(album.url);
    }

    function displayVideoInfo(title, album) {
        /* Cover thumbnail */
        const imgEl = document.getElementById('albumImage');
        imgEl.innerHTML = '';
        const img = document.createElement('img');
        img.src = `assets/covers/${album.image}`;
        img.alt = title || t('Album cover');
        img.loading = 'lazy';
        imgEl.appendChild(img);

        /* Title */
        document.getElementById('videoTitle').textContent = title;

        /* Meta chips — country · genre · mood (click a chip to filter by it) */
        const metaEl = document.getElementById('videoMeta');
        metaEl.innerHTML = '';
        const musicgrid = document.getElementById('musicgrid');
        const filtersEl = document.getElementById('sectionFilters');
        [
            album.country ? { type: 'country', value: album.country, label: countryLabel(album.country) } : null,
            album.genre   ? { type: 'genre',   value: album.genre,   label: genreLabel(album.genre) }     : null,
            album.mood    ? { type: 'mood',    value: album.mood,    label: moodLabel(album.mood) }        : null,
            ...(album.party || []).map(id => ({ type: 'party', value: id, label: partyLabel(id) })),
            album.meme    ? { type: 'meme',    value: '',            label: t('Meme') }                 : null,
        ].filter(Boolean).forEach(function (chip) {
            const c = document.createElement('button');
            c.className = 'meta-chip';
            c.dataset.ctype = chip.type;
            c.textContent = chip.label;
            c.title = t('Filter by') + ' ' + chip.label;
            c.addEventListener('click', function () {
                applyFilter(filtersEl, musicgrid, chip.type, chip.value);
            });
            metaEl.appendChild(c);
        });

        /* Platform links — deep-link when we have a real id, else search by tag */
        const linksEl = document.getElementById('videoLinks');
        linksEl.innerHTML = '';
        const q = encodeURIComponent((album.tag || '').replace(/\s*—\s*/g, ' '));
        const spotifyHref = album.spotifyurl
            ? `https://open.spotify.com/track/${album.spotifyurl}`
            : `https://open.spotify.com/search/${q}`;
        const appleHref = album.applemusicurl
            ? `https://geo.music.apple.com/${album.applemusicurl}`
            : `https://geo.music.apple.com/us/search?term=${q}`;
        [
            { label: 'YouTube', title: 'YouTube',     href: `https://www.youtube.com/watch?v=${album.url}`, platform: 'youtube' },
            { label: 'Spotify', title: 'Spotify',     href: spotifyHref,                                    platform: 'spotify' },
            { label: 'Apple',   title: 'Apple Music', href: appleHref,                                      platform: 'apple'   },
        ].forEach(function ({ label, title, href, platform }) {
            const a = document.createElement('a');
            a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer';
            a.textContent = label;
            a.title = title;
            a.dataset.platform = platform;
            linksEl.appendChild(a);
        });

        /* + Queue button — lives in the stable #videoActions container */
        const actions = document.getElementById('videoActions');
        let qBtn = document.getElementById('queueAddBtn');
        if (!qBtn) {
            qBtn = document.createElement('button');
            qBtn.id = 'queueAddBtn';
            actions.appendChild(qBtn);
        }
        const inQ = queue.some(a => a.url === album.url);
        qBtn.textContent = inQ ? t('✓ In Queue') : t('+ Add to queue');
        qBtn.disabled    = inQ;
        /* the cover thumb flies to the queue (phones hide it — then the button does) */
        qBtn.onclick     = function () {
            const thumb = document.getElementById('albumImage');
            addToQueue(album, thumb.offsetWidth ? thumb : qBtn);
        };

        if (mediaDeferred !== album) loadVideo(album.url);
        document.getElementById('videoInfoBar').classList.add('show');
        document.getElementById('prevBtn').disabled = false;
        markListPlaying();
        syncListBottom();
    }

    function closePanel() {
        document.getElementById('videoInfoBar').classList.remove('show');
        if (ytPlayer && ytPlayer.stopVideo) ytPlayer.stopVideo();
        clearLyrics();
        /* keep the card's shape while it fades out, then reset it */
        setTimeout(function () {
            const bar = document.getElementById('videoInfoBar');
            if (!bar.classList.contains('show')) setLyricsMode(false);
        }, 300);
        clearActiveCell();
        currentAlbum = null;
        renderQueue();
        updateURL();
        markListPlaying();
        syncListBottom();
        syncTransport(false);
    }

    function toggleScroll() {
        pausedByMotion = false;
        pausedByHelp = false;
        setScrollPaused(!scrollPaused);
    }

    /* ── Help overlay (Branding .modal) ─────────────────────── */
    let helpLastFocus = null;
    function helpOpen() { return !document.getElementById('helpScrim').hidden; }
    function openHelp() {
        const scrim = document.getElementById('helpScrim');
        if (!scrim.hidden) return;
        helpLastFocus = document.activeElement;
        scrim.hidden = false;
        if (!scrollPaused) { pausedByHelp = true; setScrollPaused(true); }
        document.getElementById('helpResume').focus();
    }
    function closeHelp(resume) {
        const scrim = document.getElementById('helpScrim');
        if (scrim.hidden) return;
        scrim.hidden = true;
        if (pausedByHelp || resume) { pausedByHelp = false; pausedByMotion = false; setScrollPaused(false); }
        if (helpLastFocus && helpLastFocus.focus && helpLastFocus !== document.body) helpLastFocus.focus();
    }
    function toggleFullscreen() {
        const d = document, e = d.documentElement;
        if (d.fullscreenElement) { if (d.exitFullscreen) d.exitFullscreen(); return; }
        if (e.requestFullscreen) e.requestFullscreen().catch(function () {});
    }
    function wireHelp() {
        const scrim = document.getElementById('helpScrim');
        document.getElementById('helpBtn').addEventListener('click', openHelp);
        document.getElementById('helpX').addEventListener('click', function () { closeHelp(); });
        document.getElementById('helpResume').addEventListener('click', function () { closeHelp(true); });
        document.getElementById('helpFull').addEventListener('click', function () { closeHelp(); toggleFullscreen(); });
        scrim.addEventListener('click', function (e) { if (e.target === scrim) closeHelp(); });
    }

    /* The fleet's play keys: ? or H help, P or Space pause, Esc close,
       F fullscreen, M sound; L opens the song list. Never while typing. */
    function wireKeys() {
        document.addEventListener('keydown', function (e) {
            if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
            const tg = e.target;
            if (tg && (tg.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(tg.tagName || ''))) return;
            const k = e.key;
            if (helpOpen()) {
                if (k === 'Escape' || k === '?' || k === 'h' || k === 'H') { e.preventDefault(); closeHelp(); }
                return;
            }
            if (k === '?' || k === 'h' || k === 'H') { e.preventDefault(); openHelp(); }
            else if (k === 'p' || k === 'P' || (k === ' ' && !(tg && /^(BUTTON|A)$/.test(tg.tagName || '')))) { e.preventDefault(); toggleScroll(); }
            else if (k === 'm' || k === 'M') toggleMute();
            else if (k === 'f' || k === 'F') toggleFullscreen();
            else if (k === 'l' || k === 'L') { e.preventDefault(); setListOpen(!listOpen); }
        });
    }

    /* The dock wraps to two rows on a phone, and the navbar slides away in
       fullscreen or when idle (data-immersive): keep --dock-space and the
       panels' top edge (--mg-nav) in step with both. */
    function watchStage() {
        const dock = document.getElementById('dock');
        const root = document.documentElement.style;
        function sync() {
            if (dock.offsetHeight) root.setProperty('--dock-space', (dock.offsetHeight + 20) + 'px');
            syncListBottom();
        }
        if (window.ResizeObserver) new ResizeObserver(sync).observe(dock);
        sync();
        window.addEventListener('carino:navbar', function (e) {
            if (e.detail && e.detail.hidden) root.setProperty('--mg-nav', '0px');
            else root.removeProperty('--mg-nav');
        });
    }

    /* ── Init ───────────────────────────────────────────────── */
    document.addEventListener('DOMContentLoaded', function () {
        const musicgrid   = document.getElementById('musicgrid');
        const filtersEl   = document.getElementById('sectionFilters');
        const toggleBtn   = document.getElementById('scrollToggle');
        const randomBtn   = document.getElementById('randomBtn');
        const autoplayBtn = document.getElementById('autoplayToggle');
        const closeBtn    = document.getElementById('closeInfoBar');
        const lyricsTgl   = document.getElementById('lyricsToggle');

        if (!musicgrid) { console.error('MusicGrid element not found.'); return; }

        /* The YouTube IFrame API is NOT loaded here: ensureYTApi() fetches it
           on the first play, so nothing outside loads before a click. */

        /* Seed active filter from URL before building filters / grid */
        seedStateFromURL();

        buildFilters(filtersEl, musicgrid);

        /* The button (or P / Space) pauses and resumes the wall */
        toggleBtn.addEventListener('click', toggleScroll);
        if (motionMQ) {
            if (motionMQ.matches) { pausedByMotion = true; setScrollPaused(true); }
            if (motionMQ.addEventListener) motionMQ.addEventListener('change', onMotionChange);
            else if (motionMQ.addListener) motionMQ.addListener(onMotionChange);
        }
        document.getElementById('muteBtn').addEventListener('click', toggleMute);
        applyMute();
        wireHelp();
        wireKeys();
        watchStage();

        /* Autoplay toggle — keeps music playing after a song ends, even with no queue */
        function syncAutoplayBtn() {
            autoplayBtn.classList.toggle('active', autoplayOn);
            autoplayBtn.textContent = t('Autoplay');
            autoplayBtn.setAttribute('aria-pressed', autoplayOn ? 'true' : 'false');
        }
        syncAutoplayBtn();
        autoplayBtn.addEventListener('click', function () {
            autoplayOn = !autoplayOn;
            try { localStorage.setItem('mg_autoplay', autoplayOn ? '1' : '0'); } catch (e) {}
            syncAutoplayBtn();
            /* If turned on while nothing is playing, start something right away */
            if (autoplayOn && !currentAlbum) playRandom();
        });

        /* Shuffle toggle — on: a no-repeat playlist of the section (Next,
           Autoplay and the List follow it); off: any random song, A–Z list */
        function syncShuffleBtn() {
            randomBtn.classList.toggle('active', shuffleOn);
            randomBtn.setAttribute('aria-pressed', shuffleOn ? 'true' : 'false');
            const label = shuffleOn ? t('Shuffle on: no song repeats until the whole section has played')
                                    : t('Shuffle off');
            randomBtn.title = label;
            randomBtn.setAttribute('aria-label', label);
        }
        syncShuffleBtn();
        randomBtn.addEventListener('click', function () {
            shuffleOn = !shuffleOn;
            try { localStorage.setItem('mg_shuffle', shuffleOn ? '1' : '0'); } catch (e) {}
            playlist = { key: '', order: [], played: new Set() };   /* a fresh pass */
            syncShuffleBtn();
            renderSongList();
        });

        /* ✕ on the lyrics stage only leaves lyrics mode (the song plays on,
           in the compact card); on the compact card it closes the player */
        closeBtn.addEventListener('click', function () {
            if (document.getElementById('videoInfoBar').classList.contains('lyrics-on')) {
                lyricsHidden = true;
                try { localStorage.setItem('mg_lyrics', '0'); } catch (e) {}
                setLyricsMode(false);
                updateLyricsToggle();
            } else closePanel();
        });

        /* Transport */
        document.getElementById('prevBtn').addEventListener('click', playPrevious);
        document.getElementById('playBtn').addEventListener('click', togglePlay);
        document.getElementById('nextBtn').addEventListener('click', playNext);
        syncTransport(false);

        /* Song list — ☰ List toggles it; the player card's size keeps it clear */
        document.getElementById('listToggle').addEventListener('click', function () { setListOpen(!listOpen); });
        document.getElementById('songListClose').addEventListener('click', function () { setListOpen(false); });
        const search = document.getElementById('songSearch');
        search.addEventListener('input', renderSongList);
        search.addEventListener('keydown', onSearchKey);
        if (window.ResizeObserver) new ResizeObserver(syncListBottom).observe(document.getElementById('videoInfoBar'));
        window.addEventListener('resize', syncListBottom);

        /* Lyrics toggle */
        lyricsTgl.addEventListener('click', function () {
            lyricsHidden = !lyricsHidden;
            try { localStorage.setItem('mg_lyrics', lyricsHidden ? '0' : '1'); } catch (e) {}
            setLyricsMode(!lyricsHidden && (lyricsData.length > 0 || lyricsNotes));
            updateLyricsToggle();
        });

        /* Lyrics timing — per song; the number resets it */
        document.getElementById('lyricsSooner').addEventListener('click', function () {
            setLyricsOffset(lyricsOffset + LYRICS_OFFSET_STEP, true);
        });
        document.getElementById('lyricsLater').addEventListener('click', function () {
            setLyricsOffset(lyricsOffset - LYRICS_OFFSET_STEP, true);
        });
        document.getElementById('lyricsOffsetVal').addEventListener('click', function () {
            setLyricsOffset(0, true);
        });

        /* Grid layout fix — aspect-ratio in CSS Grid can get stuck until resize.
           ResizeObserver forces a style recalc whenever the container changes.
           The flip and the restore happen in the same frame (the offsetWidth
           read forces the layout in between), so the one-column state is never
           painted: restoring it a frame later made every load jump (CLS 0.88). */
        if (window.ResizeObserver) {
            new ResizeObserver(function () {
                musicgrid.style.gridTemplateColumns = 'none';
                void musicgrid.offsetWidth;
                musicgrid.style.gridTemplateColumns = '';
            }).observe(musicgrid);
        }

        musicgrid.addEventListener('click', onGridClick);

        /* Infinite scroll — and drop what has scrolled far out of view */
        musicgrid.addEventListener('scroll', function () {
            if (musicgrid.scrollTop + musicgrid.clientHeight >=
                musicgrid.scrollHeight - musicgrid.clientHeight * 0.5) {
                populateGrid(musicgrid);
                ensureScrollable(musicgrid);
                trimGrid(musicgrid);
            }
        }, { passive: true });

        populateGrid(musicgrid);
        ensureScrollable(musicgrid);
        startAutoScroll(musicgrid);

        /* Restore song + queue from URL params (sharing support) */
        restoreFromURL();
    });

})();
