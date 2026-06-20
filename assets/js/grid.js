(function () {
    'use strict';

    const QUEUE_MAX = 10;

    /* ── State ──────────────────────────────────────────────── */
    /* filter: { type, value }
       type: 'all' | 'carino' | 'country' | 'genre'   value: id (country/genre) */
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
    /* Filter <-> URL encoding. '' = all · 'carino' · 'country:japan' · 'genre:rock'.
       A bare value (legacy ?cat=japan links) is read as a country. */
    function encodeFilter(f) {
        if (f.type === 'all')    return '';
        if (f.type === 'carino') return 'carino';
        return f.type + ':' + f.value;
    }
    function decodeFilter(s) {
        if (!s)            return { type: 'all', value: '' };
        if (s === 'carino') return { type: 'carino', value: '' };
        const i = s.indexOf(':');
        if (i < 0)         return { type: 'country', value: s };   // legacy
        const t = s.slice(0, i), v = s.slice(i + 1);
        if (t === 'country' || t === 'genre') return { type: t, value: v };
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

    /* Human label for the active filter (navbar diagnostics) */
    function filterLabel(f) {
        if (f.type === 'carino')  return '★ Carino';
        if (f.type === 'country') return countryLabel(f.value);
        if (f.type === 'genre')   return genreLabel(f.value);
        if (f.type === 'mood')    return moodLabel(f.value);
        return 'All';
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
        qBtn.setAttribute('aria-label', 'Add to queue');
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
        albums.forEach(a => { const v = a[key]; if (v) counts[v] = (counts[v] || 0) + 1; });
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
        function buildMenu(type, defLabel, data, labelFor) {
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
                item.innerHTML = '<span class="menu-item-label">' + labelFor(id) +
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
            container.appendChild(quickPill('★ Carino', 'carino', '', 'filter-carino', "Miguel's personal list"));
        }
        container.appendChild(quickPill('All', 'all', ''));

        /* Dropdown menus — only built when that dimension exists in the data */
        const dims = [
            { type: 'country', label: '🌍 Country', metaFn: countryMeta, labelFn: countryLabel },
            { type: 'genre',   label: '🎵 Genre',   metaFn: genreMeta,   labelFn: genreLabel },
            { type: 'mood',    label: '🎭 Mood',    metaFn: moodMeta,    labelFn: moodLabel },
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
        btn.textContent = inQ ? '✓ In Queue' : '+ Add to queue';
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

    function renderQueue() {
        const bar = document.getElementById('queueBar');
        bar.innerHTML = '';
        if (window.CarinoNav) window.CarinoNav.queue(queue.length);

        if (!queue.length) {
            bar.classList.remove('has-items');
            return;
        }

        bar.classList.add('has-items');

        const lbl = document.createElement('span');
        lbl.className   = 'queue-label';
        lbl.textContent = 'Queue';
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
            rm.setAttribute('aria-label', 'Remove from queue');
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
        text.split('\n').forEach(function (line) {
            const m = line.match(re);
            if (!m) return;
            const time = parseInt(m[1], 10) * 60 + parseInt(m[2], 10)
                + parseInt(m[3], 10) / (m[3].length === 2 ? 100 : 1000);
            const content = m[4].trim();
            const sep     = content.indexOf(' | ');
            cues.push({
                time,
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
            btn.textContent = lyricsHidden ? '♪ Lyrics' : '♪ Hide';
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

        /* Only show if the user hasn't hidden lyrics */
        if (lyricsHidden) return;

        const section = document.getElementById('lyricsSection');
        section.style.display = 'flex';
        void section.offsetWidth; /* force reflow */
        section.classList.add('visible');
    }

    function hideLyricsPanel() {
        const section = document.getElementById('lyricsSection');
        section.classList.remove('visible');
        section.style.display = 'none';
        lyricsData   = [];
        lyricsCueIdx = -1;
        stopLyricsSync();
        updateLyricsToggle();
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
        lyricsTimer = setInterval(function () {
            if (!ytPlayer || typeof ytPlayer.getCurrentTime !== 'function') return;
            const t = ytPlayer.getCurrentTime();
            let idx = -1;
            for (let i = 0; i < lyricsData.length; i++) {
                if (lyricsData[i].time <= t) idx = i; else break;
            }
            if (idx !== lyricsCueIdx) {
                lyricsCueIdx = idx;
                highlightLine(idx);
            }
        }, 100);
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
                onStateChange: function (e) {
                    if (e.data === YT.PlayerState.PLAYING) {
                        startLyricsSync();
                    } else if (e.data === YT.PlayerState.ENDED) {
                        stopLyricsSync();
                        advanceAfterEnd();
                    } else {
                        stopLyricsSync();
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

        hideLyricsPanel();

        /* Try to load lyrics by video ID */
        fetch(`assets/lyrics/${album.url}.lrc`)
            .then(function (r) { if (!r.ok) throw 0; return r.text(); })
            .then(function (text) {
                const cues = parseLRC(text);
                if (!cues.length) return;
                buildLyricsPanel(cues);
                if (ytPlayer && typeof ytPlayer.getPlayerState === 'function' &&
                    ytPlayer.getPlayerState() === YT.PlayerState.PLAYING) {
                    startLyricsSync();
                }
            })
            .catch(function () {});

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
        img.alt = title || 'Album cover';
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
        ].filter(Boolean).forEach(function (chip) {
            const c = document.createElement('button');
            c.className = 'meta-chip';
            c.dataset.ctype = chip.type;
            c.textContent = chip.label;
            c.title = 'Filter by ' + chip.label;
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
            ? `https://music.apple.com/${album.applemusicurl}`
            : `https://music.apple.com/us/search?term=${q}`;
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
        qBtn.textContent = inQ ? '✓ In Queue' : '+ Add to queue';
        qBtn.disabled    = inQ;
        qBtn.onclick     = function () { addToQueue(album); };

        loadVideo(album.url);
        document.getElementById('videoInfoBar').classList.add('show');
    }

    function closePanel() {
        document.getElementById('videoInfoBar').classList.remove('show');
        if (ytPlayer && ytPlayer.stopVideo) ytPlayer.stopVideo();
        hideLyricsPanel();
        clearActiveCell();
        currentAlbum = null;
        renderQueue();
        updateURL();
        if (window.CarinoNav) window.CarinoNav.nowPlaying('—', '—');
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
            toggleBtn.textContent = scrollPaused ? '▶ Resume' : '⏸ Pause';
        });

        /* Autoplay toggle — keeps music playing after a song ends, even with no queue */
        function syncAutoplayBtn() {
            autoplayBtn.classList.toggle('active', autoplayOn);
            autoplayBtn.textContent = autoplayOn ? '↻ Autoplay: On' : '↻ Autoplay';
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

        /* Lyrics toggle */
        lyricsTgl.addEventListener('click', function () {
            lyricsHidden = !lyricsHidden;
            const section = document.getElementById('lyricsSection');
            if (lyricsHidden) {
                section.classList.remove('visible');
                /* keep display:flex briefly so transition plays, then hide */
                setTimeout(function () {
                    if (lyricsHidden) section.style.display = 'none';
                }, 460);
            } else if (lyricsData.length) {
                section.style.display = 'flex';
                void section.offsetWidth;
                section.classList.add('visible');
            }
            updateLyricsToggle();
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
