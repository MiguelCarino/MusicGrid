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

    /* ── Queue ──────────────────────────────────────────────── */
    let queue = [];

    /* ── Lyrics ─────────────────────────────────────────────── */
    let lyricsData   = [];
    let lyricsCueIdx = -1;
    let lyricsTimer  = null;
    let lyricsHidden = false; /* user-toggled preference */
    let lyricsAnim   = null;  /* running card resize animation */
    let lyricsOffset = 0;     /* seconds, per song; + shows lines sooner */

    /* ── YouTube IFrame API ─────────────────────────────────── */
    let ytPlayer    = null;
    let ytReady     = false;
    let pendingVideo = null;

    window.onYouTubeIframeAPIReady = function () {
        ytReady = true;
        if (pendingVideo) { createYTPlayer(pendingVideo); pendingVideo = null; }
    };

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
            if (a) openPanel(a);
        }
    }

    /* ── Helpers ────────────────────────────────────────────── */
    function getScrollSpeed() {
        return navigator.userAgent.includes('Firefox') ? 1.4 : 1;
    }

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
        if (f.type === 'meme')    return t('😂 Meme');
        if (f.type === 'party')   return partyLabel(f.value);
        if (f.type === 'country') return countryLabel(f.value);
        if (f.type === 'genre')   return genreLabel(f.value);
        if (f.type === 'mood')    return moodLabel(f.value);
        return t('All');
    }

    /* ── Grid ───────────────────────────────────────────────── */
    function addCell(grid, album) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.style.backgroundImage = `url(assets/covers/${album.image})`;
        if (album.tag) cell.title = album.tag;

        /* Clicking the cover always plays immediately */
        cell.addEventListener('click', function () {
            setActiveCell(cell);
            openPanel(album);
        });

        /* Small + button to queue without interrupting current playback */
        const qBtn = document.createElement('button');
        qBtn.className = 'cell-queue-btn';
        qBtn.textContent = '+';
        qBtn.setAttribute('aria-label', t('Add to queue'));
        qBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            addToQueue(album);
            qBtn.textContent = '✓';
            setTimeout(function () { qBtn.textContent = '+'; }, 1000);
        });
        cell.appendChild(qBtn);

        grid.appendChild(cell);
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
    function startAutoScroll(grid) {
        if (scrollTimer) clearInterval(scrollTimer);
        const speed = getScrollSpeed();
        scrollTimer = setInterval(function () {
            if (!scrollPaused) grid.scrollTop += speed;
        }, 50);
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
        if (window.CarinoNav) window.CarinoNav.filter(filterLabel(filter));
        renderSongList();
    }

    /* ── Song list ──────────────────────────────────────────── */
    /* Every song in the current section, A–Z, searchable (accent-insensitive,
       across tag, country, genre and mood). Hidden until ☰ List is pressed. */
    let listOpen = false;
    const fold = s => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const isPhone = () => window.matchMedia('(max-width: 768px)').matches;

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
        const pool  = visibleAlbums().slice().sort((a, b) => (a.tag || '').localeCompare(b.tag || ''));
        const shown = pool.filter(a => listMatches(a, words));

        document.getElementById('songListMeta').textContent = filterLabel(filter) + ' · ' +
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
                addToQueue(album);
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
    const LIST_MIN_H = 220;
    function syncListBottom() {
        const bar  = document.getElementById('videoInfoBar');
        const list = document.getElementById('songList');
        let bottom = 18, right = 18;
        if (!isPhone() && bar.classList.contains('show') && !bar.classList.contains('lyrics-on')) {
            const above = window.innerHeight - (18 + bar.offsetHeight + 12) - list.offsetTop;
            if (above >= LIST_MIN_H) bottom = 18 + bar.offsetHeight + 12;
            else right = 18 + bar.offsetWidth + 12;
        }
        const root = document.documentElement.style;
        root.setProperty('--list-bottom', bottom + 'px');
        root.setProperty('--list-right', right + 'px');
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
            const picked = filter.type === m.type;
            m.btn.textContent = (picked ? m.labelFor(filter.value) : m.defLabel) + ' ▾';
            m.btn.classList.toggle('active', picked);
            m.panel.querySelectorAll('.menu-item').forEach(function (it) {
                it.classList.toggle('chosen', picked && it.dataset.fvalue === filter.value);
            });
        });
    }

    function buildFilters(container, grid) {
        container.innerHTML = '';
        /* Drop any panels a previous build left in <body> */
        filterMenus.forEach(function (m) { if (m.panel.parentNode) m.panel.parentNode.removeChild(m.panel); });
        filterMenus = [];

        function quickPill(label, type, value, extraClass, title) {
            const btn = document.createElement('button');
            btn.className = 'filter-btn' + (extraClass ? ' ' + extraClass : '');
            btn.textContent = label;
            btn.dataset.ftype = type;
            btn.dataset.fvalue = value || '';
            if (title) btn.title = title;
            btn.addEventListener('click', function () { closeAllMenus(); applyFilter(container, grid, type, value); });
            return btn;
        }

        /* Dropdown menu — button stays in the bar, panel lives in <body> so it
           is never clipped by the controls bar (which is a fixed-pos containing
           block thanks to its backdrop-filter). */
        function buildMenu(type, defLabel, data, labelFor, itemLabelFor) {
            const btn = document.createElement('button');
            btn.className = 'filter-btn filter-menu-btn';
            btn.textContent = defLabel + ' ▾';
            btn.dataset.menu = type;
            btn.setAttribute('aria-haspopup', 'true');
            btn.setAttribute('aria-expanded', 'false');

            const panel = document.createElement('div');
            panel.className = 'menu-panel';
            data.ids.forEach(function (id) {
                const item = document.createElement('button');
                item.className = 'menu-item';
                item.dataset.ftype = type;
                item.dataset.fvalue = id;
                item.innerHTML = '<span class="menu-item-label">' + (itemLabelFor || labelFor)(id) +
                                 '</span><span class="menu-count">' + data.counts[id] + '</span>';
                item.addEventListener('click', function () {
                    applyFilter(container, grid, type, id);
                    closeAllMenus();
                });
                panel.appendChild(item);
            });
            document.body.appendChild(panel);

            const rec = { type: type, btn: btn, panel: panel, defLabel: defLabel, labelFor: labelFor };
            filterMenus.push(rec);

            function open() {
                const wasOpen = panel.classList.contains('open');
                closeAllMenus();
                if (wasOpen) return;
                const r = btn.getBoundingClientRect();
                panel.style.top  = (r.bottom + 6) + 'px';
                panel.style.left = r.left + 'px';
                panel.classList.add('open');
                btn.classList.add('menu-open');
                btn.setAttribute('aria-expanded', 'true');
                requestAnimationFrame(function () {
                    const pr = panel.getBoundingClientRect();
                    if (pr.right > window.innerWidth - 8) {
                        panel.style.left = Math.max(8, window.innerWidth - pr.width - 8) + 'px';
                    }
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

        /* Dropdown menus — only built when that dimension exists in the data.
           🎉 Party (the songs every party plays, per country) and 😂 Meme come
           first: they are lists, the rest describe the songs. */
        const party = countBy('party', countryMeta);
        if (party.ids.length) container.appendChild(buildMenu('party', t('🎉 Party'), party, partyLabel, countryLabel));
        if (albums.some(a => a.meme)) {
            container.appendChild(quickPill(t('😂 Meme'), 'meme', '', 'filter-meme', t('Songs that became memes')));
        }
        const dims = [
            { type: 'country', label: t('🌍 Country'), metaFn: countryMeta, labelFn: countryLabel },
            { type: 'genre',   label: t('🎵 Genre'),   metaFn: genreMeta,   labelFn: genreLabel },
            { type: 'mood',    label: t('🎭 Mood'),    metaFn: moodMeta,    labelFn: moodLabel },
        ];
        dims.forEach(function (d) {
            const data = countBy(d.type, d.metaFn);
            if (data.ids.length) container.appendChild(buildMenu(d.type, d.label, data, d.labelFn));
        });

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

    function addToQueue(album) {
        if (queue.length >= QUEUE_MAX) return;
        if (queue.some(a => a.url === album.url)) return;
        queue.push(album);
        renderQueue();
        syncQueueBtn();
        updateURL();
    }

    /* The player card is fixed to the screen while the queue strip is in the
       page flow — tell the CSS how tall the strip is so the card starts below it */
    function syncQueueHeight() {
        const bar = document.getElementById('queueBar');
        document.documentElement.style.setProperty('--queue-h', (bar ? bar.offsetHeight : 0) + 'px');
    }

    function renderQueue() {
        const bar = document.getElementById('queueBar');
        bar.innerHTML = '';
        if (window.CarinoNav) window.CarinoNav.queue(queue.length);

        if (!queue.length) {
            bar.classList.remove('has-items');
            syncQueueHeight();
            return;
        }

        bar.classList.add('has-items');

        const lbl = document.createElement('span');
        lbl.className   = 'queue-label';
        lbl.textContent = t('Queue');
        bar.appendChild(lbl);

        queue.forEach(function (album, idx) {
            const item = document.createElement('div');
            item.className = 'queue-item';
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
        syncQueueHeight();
    }

    /* ── LRC parser ─────────────────────────────────────────── */
    /*
     * File: assets/lyrics/<youtube-video-id>.lrc
     * Keyed to video ID so songs sharing a cover still get separate files.
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
        const hasLyrics = lyricsData.length > 0;
        btn.style.display = hasLyrics ? '' : 'none';
        if (hasLyrics) {
            btn.textContent = lyricsHidden ? t('♪ Lyrics') : t('♪ Hide');
            btn.classList.toggle('active', !lyricsHidden);
        }
    }

    function buildLyricsPanel(cues) {
        lyricsData   = cues;
        lyricsCueIdx = -1;

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
        stopLyricsSync();
        document.getElementById('lyricsContainer').innerHTML = '';
        updateLyricsToggle();
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

    function highlightLine(idx) {
        const container = document.getElementById('lyricsContainer');
        container.querySelectorAll('.lyric-line').forEach(function (el) {
            el.classList.toggle('current', +el.dataset.idx === idx);
        });
        if (idx >= 0) {
            const el = container.querySelector(`.lyric-line[data-idx="${idx}"]`);
            if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
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

    /* Called when a song ends: queue first, else autoplay a fresh random song */
    function advanceAfterEnd() {
        if (queue.length) { playNextInQueue(); return; }
        if (!autoplayOn)  return;
        const pool = visibleAlbums().filter(a => !currentAlbum || a.url !== currentAlbum.url);
        const next = pool.length ? pool[Math.floor(Math.random() * pool.length)]
                   : (currentAlbum || null);
        if (next) { clearActiveCell(); openPanel(next); }
    }

    /* ── YouTube player ─────────────────────────────────────── */
    function createYTPlayer(videoId) {
        const slot = document.getElementById('ytPlayerSlot');
        slot.innerHTML = '';
        const div = document.createElement('div');
        slot.appendChild(div);

        ytPlayer = new YT.Player(div, {
            videoId,
            width: 640, height: 360,
            playerVars: { autoplay: 1, rel: 0, modestbranding: 1 },
            events: {
                onReady: syncLyricsNow,   /* a saved offset can land on a line before play */
                onStateChange: function (e) {
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
        if (ytPlayer && typeof ytPlayer.loadVideoById === 'function') {
            ytPlayer.loadVideoById(videoId);
        } else if (ytReady) {
            createYTPlayer(videoId);
        } else {
            pendingVideo = videoId;
        }
    }

    /* ── Info panel ─────────────────────────────────────────── */
    function openPanel(album) {
        currentAlbum = album;
        updateURL();

        clearLyrics();
        setLyricsOffset(readOffsets()[album.url] || 0, false);

        /* Try to load lyrics by video ID */
        fetch(`assets/lyrics/${album.url}.lrc`)
            .then(function (r) { if (!r.ok) throw 0; return r.text(); })
            .then(function (text) {
                if (currentAlbum !== album) return; /* a newer song took over */
                const cues = parseLRC(text);
                if (!cues.length) throw 0;
                buildLyricsPanel(cues);
                syncLyricsNow();   /* the song's saved offset may already land on a line */
                if (ytPlayer && typeof ytPlayer.getPlayerState === 'function' &&
                    ytPlayer.getPlayerState() === YT.PlayerState.PLAYING) {
                    startLyricsSync();
                }
            })
            .catch(function () { if (currentAlbum === album) setLyricsMode(false); });

        /* Title comes straight from the catalog tag — no API key, no quota. */
        displayVideoInfo(album.tag || '', album);
        renderQueue();
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
            album.meme    ? { type: 'meme',    value: '',            label: t('😂 Meme') }                 : null,
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

        /* Feed the navbar diagnostics */
        if (window.CarinoNav) {
            const origin = [
                album.country ? countryLabel(album.country) : '',
                album.genre   ? genreLabel(album.genre)     : '',
                album.mood    ? moodLabel(album.mood)       : ''
            ].filter(Boolean).join(' · ') || '—';
            window.CarinoNav.nowPlaying(title || album.tag || '—', origin);
        }

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
            { label: 'YouTube',     href: `https://www.youtube.com/watch?v=${album.url}`, platform: 'youtube' },
            { label: 'Spotify',     href: spotifyHref,                                    platform: 'spotify' },
            { label: 'Apple Music', href: appleHref,                                      platform: 'apple'   },
        ].forEach(function ({ label, href, platform }) {
            const a = document.createElement('a');
            a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer';
            a.textContent = label;
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
        qBtn.onclick     = function () { addToQueue(album); };

        loadVideo(album.url);
        document.getElementById('videoInfoBar').classList.add('show');
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
        if (window.CarinoNav) window.CarinoNav.nowPlaying('—', '—');
        markListPlaying();
        syncListBottom();
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

        /* Load YouTube IFrame API */
        const s = document.createElement('script');
        s.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(s);

        /* Seed active filter from URL before building filters / grid */
        seedStateFromURL();

        buildFilters(filtersEl, musicgrid);
        if (window.CarinoNav) window.CarinoNav.filter(filterLabel(filter));

        /* ONLY the button pauses/resumes scroll */
        toggleBtn.addEventListener('click', function () {
            scrollPaused = !scrollPaused;
            toggleBtn.textContent = scrollPaused ? t('▶ Resume') : t('⏸ Pause');
        });

        /* Autoplay toggle — keeps music playing after a song ends, even with no queue */
        function syncAutoplayBtn() {
            autoplayBtn.classList.toggle('active', autoplayOn);
            autoplayBtn.textContent = autoplayOn ? t('↻ Autoplay: On') : t('↻ Autoplay');
        }
        syncAutoplayBtn();
        autoplayBtn.addEventListener('click', function () {
            autoplayOn = !autoplayOn;
            try { localStorage.setItem('mg_autoplay', autoplayOn ? '1' : '0'); } catch (e) {}
            syncAutoplayBtn();
            /* If turned on while nothing is playing, start something right away */
            if (autoplayOn && !currentAlbum) {
                const pool = visibleAlbums();
                if (pool.length) { clearActiveCell(); openPanel(pool[Math.floor(Math.random() * pool.length)]); }
            }
        });

        /* Random always plays immediately, ignoring "currently playing" rule */
        randomBtn.addEventListener('click', function () {
            const pool = visibleAlbums();
            if (!pool.length) return;
            clearActiveCell();
            openPanel(pool[Math.floor(Math.random() * pool.length)]);
        });

        closeBtn.addEventListener('click', closePanel);

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
            setLyricsMode(!lyricsHidden && lyricsData.length > 0);
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
           ResizeObserver forces a style recalc whenever the container changes. */
        if (window.ResizeObserver) {
            new ResizeObserver(function () {
                musicgrid.style.gridTemplateColumns = 'none';
                requestAnimationFrame(function () {
                    musicgrid.style.gridTemplateColumns = '';
                });
            }).observe(musicgrid);
        }

        /* Tab-out fix: browsers throttle setInterval in background tabs */
        document.addEventListener('visibilitychange', function () {
            if (!document.hidden) startAutoScroll(musicgrid);
        });

        /* Infinite scroll */
        musicgrid.addEventListener('scroll', function () {
            if (musicgrid.scrollTop + musicgrid.clientHeight >=
                musicgrid.scrollHeight - musicgrid.clientHeight * 0.5) {
                populateGrid(musicgrid);
                ensureScrollable(musicgrid);
            }
        });

        populateGrid(musicgrid);
        ensureScrollable(musicgrid);
        startAutoScroll(musicgrid);

        /* Restore song + queue from URL params (sharing support) */
        restoreFromURL();
    });

})();
