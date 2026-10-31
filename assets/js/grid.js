/* MusicGrid — the control page.
 *
 *   Toolbar   search (songs, artists; matching lists as chips) and which
 *             list the wall shows (All · ★ Carino · Lists)
 *   Stage     the cover wall (Browse); the lyrics stage over it when lyrics
 *             are on; the Now playing + Up next panel on its right (a sheet
 *             over it on a phone)
 *   Player    what plays, prev · play · next, progress, lyrics, Up next,
 *             volume
 *   Settings  every switch, behind ⚙ in the navbar
 *
 * State lives here; every change is announced on the MusicGrid bus
 * (mg-core.js), which also carries the saved settings. The actions are
 * published on window.MusicGrid at the end of init.
 */
(function () {
    'use strict';

    const MG = window.MusicGrid;
    const S  = MG.settings;
    const tr = function (k) { return typeof t === 'function' ? t(k) : k; };
    const $  = function (id) { return document.getElementById(id); };
    const fold = MG.fold, splitTag = MG.splitTag;

    /* A sanity cap only: the queue is meant to be long at a party, and the
       URL (?q=) stays well under any limit at this size. */
    const QUEUE_MAX = 200;

    /* ── State ──────────────────────────────────────────────── */
    /* filter: { type: 'all' | 'carino' | 'meme' | 'party' | 'country' |
       'genre' | 'mood', value } (party lists are keyed by country) */
    let filter       = { type: 'all', value: '' };
    let currentAlbum = null;      /* the song in the player */
    let queue        = [];        /* Up next: albums, played before the shuffle */
    let playlist     = { key: '', order: [], played: new Set() };
    let activeCell   = null;
    let panelHidden  = false;     /* the visitor tucked Now playing away */
    let isPlaying    = false;

    /* ── Lyrics ─────────────────────────────────────────────── */
    let lyricsData   = [];
    let lyricsCueIdx = -1;
    let lyricsOffset = 0;     /* seconds, per song; + shows lines sooner */
    let lyricsNotes  = false; /* no lyrics (missing or instrumental): music notes instead */
    let notesTimer   = null;  /* shows the notes if no lyrics arrive within NOTES_AFTER */

    /* ── Helpers ────────────────────────────────────────────── */
    const isPhone  = function () { return window.matchMedia('(max-width: 640px)').matches; };
    const coarse   = function () { return window.matchMedia('(pointer: coarse)').matches; };
    const reduced  = function () { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; };
    const cover    = function (a) { return 'assets/covers/' + a.image; };

    function shuffle(arr) {
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const x = a[i]; a[i] = a[j]; a[j] = x;
        }
        return a;
    }
    function fmtTime(s) {
        s = Math.max(0, Math.floor(+s || 0));
        const m = Math.floor(s / 60), r = s % 60;
        return m + ':' + (r < 10 ? '0' : '') + r;
    }
    function svgIcon(path, cls) {
        return '<svg class="mg-i' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" aria-hidden="true">' + path + '</svg>';
    }
    const ICON = {
        plus:   '<path d="M12 5v14M5 12h14"/>',
        next:   '<path d="M4 7h11M4 12h7M4 17h7"/><path d="M16 13l5 3.5-5 3.5z" class="fill"/>',
        up:     '<path d="m6 15 6-6 6 6"/>',
        down:   '<path d="m6 9 6 6 6-6"/>',
        x:      '<path d="M18 6 6 18M6 6l12 12"/>',
        grip:   '<circle cx="9" cy="6" r="1.4" class="fill"/><circle cx="15" cy="6" r="1.4" class="fill"/><circle cx="9" cy="12" r="1.4" class="fill"/><circle cx="15" cy="12" r="1.4" class="fill"/><circle cx="9" cy="18" r="1.4" class="fill"/><circle cx="15" cy="18" r="1.4" class="fill"/>',
        check:  '<path d="M20 6 9 17l-5-5"/>',
    };

    function albumByUrl(vid) { return albums.find(function (a) { return a.url === vid; }) || null; }
    function toAlbum(x) { return typeof x === 'string' ? albumByUrl(x) : x; }

    /* ── Party lock (party.js owns it; MusicGrid.lock) ──────── */
    /* While it is on, guests can search, add to Up next and start the music
       when nothing plays; skipping, seeking, pausing, the list, settings and
       other people's Up next ask for the PIN. guard(what, then) is true when
       the action may go ahead; otherwise party.js asks, and runs then() once
       the host unlocks. Songs added while locked can be taken out again by
       whoever added them (guestAdds). */
    function locked() { return !!(MG.lock && MG.lock.locked()); }
    function guard(what, then) {
        if (!locked()) return true;
        MG.lock.ask(what, then);
        return false;
    }
    const guestAdds = new Set();
    /* a guest's "play this" while music plays goes to Up next instead */
    function playOrQueue(album, opts) {
        if (locked() && currentAlbum && isPlaying) return enqueue(album, opts);
        play(album, opts);
        return true;
    }

    function visibleAlbums() {
        const f = filter;
        if (f.type === 'carino')  return albums.filter(function (a) { return a.carino; });
        if (f.type === 'meme')    return albums.filter(function (a) { return a.meme; });
        if (f.type === 'party')   return albums.filter(function (a) { return (a.party || []).includes(f.value); });
        if (f.type === 'country') return albums.filter(function (a) { return (a.country || '') === f.value; });
        if (f.type === 'genre')   return albums.filter(function (a) { return (a.genre || '') === f.value; });
        if (f.type === 'mood')    return albums.filter(function (a) { return (a.mood || '') === f.value; });
        return albums;
    }

    /* Registry lookups (COUNTRIES / GENRES / MOODS in catalog.json) */
    function countryMeta(id) { const r = (typeof COUNTRIES !== 'undefined' && COUNTRIES) || {}; return r[id] || { name: id, flag: '🏳️' }; }
    function genreMeta(id)   { const r = (typeof GENRES !== 'undefined' && GENRES) || {};       return r[id] || { name: id, icon: '🎵' }; }
    function moodMeta(id)    { const r = (typeof MOODS !== 'undefined' && MOODS) || {};         return r[id] || { name: id, icon: '🎭' }; }
    function countryLabel(id) { const m = countryMeta(id); return m.flag + ' ' + m.name; }
    function genreLabel(id)   { const m = genreMeta(id);   return m.icon + ' ' + m.name; }
    function moodLabel(id)    { const m = moodMeta(id);    return m.icon + ' ' + m.name; }
    function partyLabel(id)   { return '🎉 ' + tr('Party') + ' · ' + countryLabel(id); }

    function filterLabel(f) {
        if (f.type === 'carino')  return '★ Carino';
        if (f.type === 'meme')    return '😂 ' + tr('Meme');
        if (f.type === 'party')   return partyLabel(f.value);
        if (f.type === 'country') return countryLabel(f.value);
        if (f.type === 'genre')   return genreLabel(f.value);
        if (f.type === 'mood')    return moodLabel(f.value);
        return tr('All');
    }

    /* the phone's toolbar has room for a few characters only */
    function shortLabel(f) {
        if (f.type === 'party') return '🎉 ' + countryMeta(f.value).flag;
        if (f.type === 'meme') return '😂';
        return filterLabel(f);
    }

    /* ── URL state ──────────────────────────────────────────── */
    /* ?v= the song in the player · ?q= Up next (ids, comma-separated) ·
       ?cat= the wall's list ('carino', 'meme', 'party:mexico',
       'country:japan', 'genre:rock', 'mood:chill'; a bare value is a
       legacy country) · ?s= the search box. replaceState: no history spam. */
    function encodeFilter(f) {
        if (f.type === 'all') return '';
        if (f.type === 'carino' || f.type === 'meme') return f.type;
        return f.type + ':' + f.value;
    }
    function decodeFilter(s) {
        if (!s) return { type: 'all', value: '' };
        if (s === 'carino' || s === 'meme') return { type: s, value: '' };
        const i = s.indexOf(':');
        if (i < 0) return { type: 'country', value: s };
        const ty = s.slice(0, i), v = s.slice(i + 1);
        if (['country', 'genre', 'mood', 'party'].includes(ty)) return { type: ty, value: v };
        return { type: 'all', value: '' };
    }
    function updateURL() {
        const p = new URLSearchParams(location.search);
        ['v', 'q', 'cat', 's'].forEach(function (k) { p.delete(k); });
        if (currentAlbum)          p.set('v', currentAlbum.url);
        if (queue.length)          p.set('q', queue.map(function (a) { return a.url; }).join(','));
        if (filter.type !== 'all') p.set('cat', encodeFilter(filter));
        const s = ($('searchInput').value || '').trim();
        if (s) p.set('s', s);
        const qs = p.toString();
        history.replaceState(null, '', qs ? '?' + qs : location.pathname);
    }

    /* ══ The wall (Browse) ═════════════════════════════════════ */
    /* Cells carry their album; clicks are handled once on the grid. */
    function addCell(grid, album) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.style.backgroundImage = 'url(' + cover(album) + ')';
        if (album.tag) cell.title = album.tag;
        cell._album = album;
        const qBtn = document.createElement('button');
        qBtn.type = 'button';
        qBtn.className = 'cell-queue-btn';
        qBtn.innerHTML = svgIcon(ICON.plus);
        qBtn.setAttribute('aria-label', tr('Add to queue') + ': ' + (album.tag || ''));
        cell.appendChild(qBtn);
        grid.appendChild(cell);
    }

    function onGridClick(e) {
        const cell = e.target.closest('.cell');
        if (!cell) return;
        const qBtn = e.target.closest('.cell-queue-btn');
        if (qBtn) {
            enqueue(cell._album, { from: 'wall', el: cell });
            qBtn.innerHTML = svgIcon(ICON.check);
            qBtn.classList.add('done');
            setTimeout(function () { qBtn.innerHTML = svgIcon(ICON.plus); qBtn.classList.remove('done'); }, 1100);
            return;
        }
        if (locked() && currentAlbum && isPlaying) { enqueue(cell._album, { from: 'wall', el: cell }); return; }
        setActiveCell(cell);
        play(cell._album, { from: 'wall' });
    }

    function cellsNeeded(grid) {
        const w = grid.clientWidth || window.innerWidth, h = grid.clientHeight || window.innerHeight;
        const size = isPhone() ? 90 : 130;   /* matches minmax() in CSS */
        return Math.max(200, Math.max(1, Math.floor(w / size)) * Math.max(1, Math.ceil(h / size)) * 3);
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
    function ensureScrollable(grid) {
        if (!visibleAlbums().length) return;
        let guard = 0;
        while (grid.scrollHeight <= grid.clientHeight + 10 && guard++ < 10) populateGrid(grid);
    }
    /* Infinite scroll only appends, so once the wall passes twice what fills
       the screen, whole rows that scrolled out of view are dropped from the
       top and scrollTop moves up by the same amount (nothing on screen moves). */
    function trimGrid(grid) {
        const over = grid.children.length - cellsNeeded(grid) * 2;
        if (over <= 0) return;
        const cols = getComputedStyle(grid).gridTemplateColumns.split(' ').length;
        const rowH = grid.firstElementChild.offsetHeight;
        if (!cols || !rowH) return;
        const rows = Math.min(Math.floor(over / cols), Math.floor(grid.scrollTop / rowH) - 1);
        if (rows <= 0) return;
        const n = rows * cols, anchor = grid.children[n], before = anchor.offsetTop;
        for (let i = 0; i < n; i++) {
            const c = grid.firstElementChild;
            if (c === activeCell) activeCell = null;
            c.remove();
        }
        grid.scrollTop -= before - anchor.offsetTop;
    }
    function refreshGrid() {
        const grid = $('musicgrid');
        grid.innerHTML = '';
        setActiveCell(null);
        populateGrid(grid);
        ensureScrollable(grid);
        grid.scrollTop = 0;
    }
    function setActiveCell(cell) {
        if (activeCell) activeCell.classList.remove('active');
        activeCell = cell;
        if (cell) cell.classList.add('active');
    }

    /* Auto-scroll: 20 px/s, stepped per frame with the fraction carried
       (Firefox rounds and WebKit truncates a fractional scrollTop). It
       stops for the Moving wall setting, under reduced motion (read live),
       while help or settings are open, and while the pointer rests on the
       wall, so a cover never slides out from under a click. */
    const SCROLL_PX_PER_S = 20;
    const motionMQ = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    let holdWall = 0, hoverWall = false;
    function wallMoving() {
        return S.get('wallMotion') && !(motionMQ && motionMQ.matches) && !holdWall && !hoverWall;
    }
    function startAutoScroll(grid) {
        let last = performance.now(), carry = 0;
        requestAnimationFrame(function step(now) {
            const dt = Math.min(now - last, 100);
            last = now;
            if (wallMoving()) {
                carry += SCROLL_PX_PER_S * dt / 1000;
                const px = Math.floor(carry);
                if (px) { grid.scrollTop += px; carry -= px; }
            }
            requestAnimationFrame(step);
        });
    }

    /* ══ Lists: the wall's filter ══════════════════════════════ */
    function countBy(key, metaFn) {
        const counts = {};
        albums.forEach(function (a) {
            [].concat(a[key] || []).forEach(function (v) { counts[v] = (counts[v] || 0) + 1; });
        });
        const ids = Object.keys(counts).sort(function (a, b) {
            return counts[b] - counts[a] || metaFn(a).name.localeCompare(metaFn(b).name);
        });
        return { counts: counts, ids: ids };
    }

    function applyFilter(type, value) {
        value = value || '';
        if (filter.type === type && filter.value === value) return;
        filter = { type: type, value: value };
        refreshGrid();
        updateURL();
        syncScopeUI();
        renderThen();
        if (searchOpen()) renderSearch();
        MG.emit('filter', { filter: Object.assign({}, filter), label: filterLabel(filter), count: visibleAlbums().length });
    }

    function syncScopeUI() {
        const listy = !['all', 'carino'].includes(filter.type);
        $('scopeAll').setAttribute('aria-pressed', filter.type === 'all' ? 'true' : 'false');
        $('scopeCarino').setAttribute('aria-pressed', filter.type === 'carino' ? 'true' : 'false');
        const lists = $('scopeLists');
        lists.classList.toggle('active', listy);
        lists.classList.toggle('filtered', filter.type !== 'all');
        /* on a phone this one button is the whole scope: it names the list */
        $('scopeListsLabel').textContent = isPhone() && filter.type !== 'all' ? shortLabel(filter)
                                         : listy ? filterLabel(filter) : tr('Lists');
        lists.title = tr('Lists') + ' — ' + filterLabel(filter);
        const n = visibleAlbums().length;
        $('wallCount').textContent = n + ' ' + tr('songs');
    }

    /* The Lists dialog: All / ★ Carino on top, then tabs (Lists · Country ·
       Genre · Mood) and one search box across all of them. */
    let listsUI = null;
    function buildLists() {
        const tabs = [];
        const curated = [];
        const party = countBy('party', countryMeta);
        party.ids.forEach(function (id) { curated.push({ type: 'party', value: id, label: tr('Party') + ' · ' + countryLabel(id), count: party.counts[id] }); });
        const memeCount = albums.filter(function (a) { return a.meme; }).length;
        if (memeCount) curated.push({ type: 'meme', value: '', label: '😂 ' + tr('Meme'), count: memeCount });
        if (curated.length) tabs.push({ id: 'lists', label: tr('Lists'), items: curated });
        [
            { type: 'country', label: tr('Country'), metaFn: countryMeta, labelFn: countryLabel },
            { type: 'genre',   label: tr('Genre'),   metaFn: genreMeta,   labelFn: genreLabel },
            { type: 'mood',    label: tr('Mood'),    metaFn: moodMeta,    labelFn: moodLabel },
        ].forEach(function (d) {
            const data = countBy(d.type, d.metaFn);
            if (data.ids.length) tabs.push({ id: d.type, label: d.label,
                items: data.ids.map(function (id) { return { type: d.type, value: id, label: d.labelFn(id), count: data.counts[id] }; }) });
        });
        return tabs;
    }

    function ensureListsUI() {
        if (listsUI) return listsUI;
        const scrim = document.createElement('div');
        scrim.className = 'lists-scrim';
        const panel = document.createElement('div');
        panel.className = 'lists-panel';
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-modal', 'true');
        panel.innerHTML =
            '<div class="lists-head"><span class="lists-title"></span><button type="button" class="mg-icon-btn lists-close">' + svgIcon(ICON.x) + '</button></div>' +
            '<div class="lists-quick"></div>' +
            '<input type="search" class="lists-search input" autocomplete="off" spellcheck="false">' +
            '<div class="lists-tabs" role="tablist"></div>' +
            '<div class="lists-body"></div>';
        document.body.append(scrim, panel);
        const ui = { scrim: scrim, panel: panel, tab: null, tabs: [], lastFocus: null,
                     search: panel.querySelector('.lists-search'), tabBar: panel.querySelector('.lists-tabs'),
                     body: panel.querySelector('.lists-body'), quick: panel.querySelector('.lists-quick') };
        scrim.addEventListener('click', closeLists);
        panel.querySelector('.lists-close').addEventListener('click', closeLists);
        ui.search.addEventListener('input', renderLists);
        ui.search.addEventListener('keydown', function (e) {
            /* preventDefault: focus goes back to the Lists button, which the
               same Enter would otherwise press again */
            if (e.key === 'Enter') { e.preventDefault(); const first = ui.body.querySelector('.lists-tile'); if (first) first.click(); }
        });
        panel.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.stopPropagation(); closeLists(); } });
        listsUI = ui;
        return ui;
    }

    function coversOf(it) {
        const hits = [];
        for (let i = 0; i < albums.length && hits.length < 4; i++) {
            const a = albums[i];
            /* All: spread across the catalogue, not its first (★ Carino) songs */
            if (it.type === 'all') { const b = albums[Math.floor(i * albums.length / 4) % albums.length]; if (!hits.includes(b.image)) hits.push(b.image); continue; }
            const ok = it.type === 'meme' ? a.meme : it.type === 'carino' ? a.carino
                     : [].concat(a[it.type] || []).includes(it.value);
            if (ok && !hits.includes(a.image)) hits.push(a.image);
        }
        return hits;
    }
    function listTile(it) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'lists-tile';
        const chosen = filter.type === it.type && (filter.value || '') === (it.value || '');
        b.classList.toggle('chosen', chosen);
        b.setAttribute('aria-pressed', chosen ? 'true' : 'false');
        const mosaic = document.createElement('span');
        mosaic.className = 'lists-mosaic';
        mosaic.setAttribute('aria-hidden', 'true');
        coversOf(it).forEach(function (img) {
            const im = document.createElement('img');
            im.src = 'assets/covers/' + img; im.alt = ''; im.loading = 'lazy';
            mosaic.appendChild(im);
        });
        const name = document.createElement('span');
        name.className = 'lists-name';
        name.textContent = it.label;
        const count = document.createElement('span');
        count.className = 'lists-count';
        count.textContent = it.count + ' ' + tr('songs');
        b.append(mosaic, name, count);
        b.addEventListener('click', function () { applyFilter(it.type, it.value); closeLists(); });
        return b;
    }
    function renderLists() {
        const ui = listsUI;
        const q = fold(ui.search.value.trim());
        ui.quick.innerHTML = '';
        if (!q) {
            ui.quick.append(
                listTile({ type: 'all', value: '', label: tr('All songs'), count: albums.length }),
                listTile({ type: 'carino', value: '', label: '★ Carino', count: albums.filter(function (a) { return a.carino; }).length }));
        }
        ui.tabBar.hidden = !!q;
        ui.tabBar.innerHTML = '';
        ui.tabs.forEach(function (tb) {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'lists-tab';
            b.setAttribute('role', 'tab');
            b.setAttribute('aria-selected', tb.id === ui.tab ? 'true' : 'false');
            b.textContent = tb.label;
            b.addEventListener('click', function () { ui.tab = tb.id; renderLists(); });
            ui.tabBar.appendChild(b);
        });
        ui.body.innerHTML = '';
        if (!q) {
            const tb = ui.tabs.find(function (x) { return x.id === ui.tab; });
            if (tb) tb.items.forEach(function (it) { ui.body.appendChild(listTile(it)); });
            return;
        }
        let any = false;
        ui.tabs.forEach(function (tb) {
            const hits = tb.items.filter(function (it) { return fold(it.label).includes(q); });
            if (!hits.length) return;
            any = true;
            const h = document.createElement('div');
            h.className = 'lists-group';
            h.textContent = tb.label;
            ui.body.appendChild(h);
            hits.forEach(function (it) { ui.body.appendChild(listTile(it)); });
        });
        if (!any) {
            const e = document.createElement('div');
            e.className = 'lists-empty';
            e.textContent = tr('No lists match');
            ui.body.appendChild(e);
        }
    }
    function openLists() {
        const ui = ensureListsUI();
        closeSearch();
        ui.tabs = buildLists();
        const cur = ui.tabs.find(function (tb) { return tb.items.some(function (it) { return it.type === filter.type; }); });
        ui.tab = cur ? cur.id : (ui.tabs[0] && ui.tabs[0].id);
        ui.search.value = '';
        ui.search.placeholder = tr('Search lists…');
        ui.search.setAttribute('aria-label', tr('Search lists…'));
        ui.panel.setAttribute('aria-label', tr('Lists'));
        ui.panel.querySelector('.lists-title').textContent = tr('Lists');
        ui.panel.querySelector('.lists-close').setAttribute('aria-label', tr('Close'));
        renderLists();
        ui.lastFocus = document.activeElement;
        ui.scrim.classList.add('open');
        ui.panel.classList.add('open');
        $('scopeLists').setAttribute('aria-expanded', 'true');
        holdWall++;
        requestAnimationFrame(function () {
            const chosen = ui.body.querySelector('.lists-tile.chosen');
            if (chosen) chosen.scrollIntoView({ block: 'nearest' });
            if (!coarse()) ui.search.focus(); else ui.panel.querySelector('.lists-close').focus();
        });
    }
    function closeLists() {
        const ui = listsUI;
        if (!ui || !ui.panel.classList.contains('open')) return;
        ui.scrim.classList.remove('open');
        ui.panel.classList.remove('open');
        $('scopeLists').setAttribute('aria-expanded', 'false');
        holdWall = Math.max(0, holdWall - 1);
        if (ui.lastFocus && ui.lastFocus.focus && document.contains(ui.lastFocus)) ui.lastFocus.focus();
    }
    function listsOpen() { return !!(listsUI && listsUI.panel.classList.contains('open')); }

    /* ══ Search ════════════════════════════════════════════════ */
    /* Every song in the catalogue (not just the wall's list), accent-
       insensitive across title, artist, country, genre and mood; matching
       lists come first as chips. With an empty box it lists the songs of
       the list on the wall (in shuffle order when shuffling, else A–Z). */
    let searchIndex = null, searchSel = -1, searchRows = [];
    function buildIndex() {
        searchIndex = albums.map(function (a) {
            const st = splitTag(a);
            return { a: a, title: fold(st.title), artist: fold(st.artist),
                     hay: fold([a.tag, countryMeta(a.country).name, genreMeta(a.genre).name, moodMeta(a.mood).name].join(' ')) };
        });
    }
    function searchSongs(query, limit) {
        if (!searchIndex) buildIndex();
        const q = fold(query).trim();
        const words = q.split(/\s+/).filter(Boolean);
        if (!words.length) return [];
        const hits = [];
        searchIndex.forEach(function (r) {
            if (!words.every(function (w) { return r.hay.includes(w); })) return;
            let score = 4;
            if (r.title.startsWith(q)) score = 0;
            else if (r.artist.startsWith(q)) score = 1;
            else if ((' ' + r.title + ' ' + r.artist).includes(' ' + words[0])) score = 2;
            else if (r.title.includes(q) || r.artist.includes(q)) score = 3;
            hits.push({ a: r.a, score: score, title: r.title });
        });
        hits.sort(function (x, y) { return x.score - y.score || x.title.localeCompare(y.title); });
        return hits.slice(0, limit || 60).map(function (h) { return h.a; });
    }
    function searchLists(query) {
        const q = fold(query).trim();
        if (q.length < 2) return [];
        const out = [];
        const consider = function (type, value, label, count) {
            if (count && fold(label).includes(q)) out.push({ type: type, value: value, label: label, count: count });
        };
        consider('carino', '', '★ Carino', albums.filter(function (a) { return a.carino; }).length);
        consider('meme', '', '😂 ' + tr('Meme'), albums.filter(function (a) { return a.meme; }).length);
        const party = countBy('party', countryMeta);
        party.ids.forEach(function (id) { consider('party', id, partyLabel(id), party.counts[id]); });
        [['country', countryMeta, countryLabel], ['genre', genreMeta, genreLabel], ['mood', moodMeta, moodLabel]].forEach(function (d) {
            const c = countBy(d[0], d[1]);
            c.ids.forEach(function (id) { consider(d[0], id, d[2](id), c.counts[id]); });
        });
        /* an exact-ish name first, then the bigger lists */
        out.sort(function (a, b) {
            return (fold(a.label).indexOf(q) - fold(b.label).indexOf(q)) || b.count - a.count;
        });
        return out.slice(0, 8);
    }
    function sectionSongs() {
        if (S.get('shuffle')) {
            const pl = ensurePlaylist();
            const byUrl = new Map(visibleAlbums().map(function (a) { return [a.url, a]; }));
            const ordered = pl.order.map(function (u) { return byUrl.get(u); }).filter(Boolean);
            return ordered.filter(function (a) { return !pl.played.has(a.url); })
                .concat(ordered.filter(function (a) { return pl.played.has(a.url); }));
        }
        return visibleAlbums().slice().sort(function (a, b) { return (a.tag || '').localeCompare(b.tag || ''); });
    }

    function searchOpen() { return !$('searchPanel').hidden; }
    function openSearch() {
        if (searchOpen()) return;
        closeLists();
        $('searchPanel').hidden = false;
        $('searchInput').setAttribute('aria-expanded', 'true');
        renderSearch();
    }
    function closeSearch() {
        if (!searchOpen()) return;
        $('searchPanel').hidden = true;
        $('searchInput').setAttribute('aria-expanded', 'false');
        $('searchInput').removeAttribute('aria-activedescendant');
    }

    /* A song row: cover, title, artist; Play next and Add buttons. Used by
       search, the wall's list and the Then preview. */
    function songRow(album, opts) {
        const row = document.createElement('li');
        row.className = 'mg-row';
        row.dataset.url = album.url;
        if (opts.id) row.id = opts.id;
        row.setAttribute('role', opts.role || 'listitem');
        if (currentAlbum && currentAlbum.url === album.url) row.classList.add('playing');
        const st = splitTag(album);
        const main = document.createElement('button');
        main.type = 'button';
        main.className = 'mg-row-main';
        main.tabIndex = opts.role === 'option' ? -1 : 0;
        main.innerHTML = '<img alt="" loading="lazy"><span class="mg-row-text"><span class="mg-row-title"></span><span class="mg-row-sub"></span></span>';
        main.querySelector('img').src = cover(album);
        main.querySelector('.mg-row-title').textContent = st.title;
        main.querySelector('.mg-row-sub').textContent = countryMeta(album.country).flag + ' ' + (st.artist || '');
        main.title = tr('Play now') + ': ' + (album.tag || '');
        main.addEventListener('click', function () { opts.onPlay(album); });
        row.appendChild(main);
        const acts = document.createElement('span');
        acts.className = 'mg-row-acts';
        const inQ = queue.some(function (a) { return a.url === album.url; });
        const nextB = document.createElement('button');
        nextB.type = 'button';
        nextB.className = 'mg-icon-btn mg-row-btn';
        nextB.innerHTML = svgIcon(ICON.next);
        nextB.setAttribute('aria-label', tr('Play next') + ': ' + (album.tag || ''));
        nextB.title = tr('Play next');
        nextB.tabIndex = opts.role === 'option' ? -1 : 0;
        nextB.addEventListener('click', function (e) { e.stopPropagation(); enqueue(album, { next: true, from: opts.from, el: main.querySelector('img') }); refreshRowState(row, album); });
        const addB = document.createElement('button');
        addB.type = 'button';
        addB.className = 'mg-icon-btn mg-row-btn mg-row-add' + (inQ ? ' done' : '');
        addB.innerHTML = svgIcon(inQ ? ICON.check : ICON.plus);
        addB.setAttribute('aria-label', (inQ ? tr('In Up next') : tr('Add to queue')) + ': ' + (album.tag || ''));
        addB.title = inQ ? tr('In Up next') : tr('Add to queue');
        addB.tabIndex = opts.role === 'option' ? -1 : 0;
        addB.addEventListener('click', function (e) { e.stopPropagation(); enqueue(album, { from: opts.from, el: main.querySelector('img') }); refreshRowState(row, album); });
        acts.append(nextB, addB);
        row.appendChild(acts);
        return row;
    }
    function refreshRowState(row, album) {
        const inQ = queue.some(function (a) { return a.url === album.url; });
        const addB = row.querySelector('.mg-row-add');
        if (!addB) return;
        addB.classList.toggle('done', inQ);
        addB.innerHTML = svgIcon(inQ ? ICON.check : ICON.plus);
        addB.title = inQ ? tr('In Up next') : tr('Add to queue');
        addB.setAttribute('aria-label', addB.title + ': ' + (album.tag || ''));
    }

    function renderSearch() {
        const panel = $('searchPanel');
        const raw = $('searchInput').value;
        const q = raw.trim();
        panel.innerHTML = '';
        searchRows = [];
        searchSel = -1;
        $('searchInput').removeAttribute('aria-activedescendant');

        if (q) {
            const lists = searchLists(q);
            if (lists.length) {
                const chips = document.createElement('div');
                chips.className = 'mg-chips';
                chips.setAttribute('role', 'group');
                chips.setAttribute('aria-label', tr('Lists'));
                lists.forEach(function (it) {
                    const c = document.createElement('button');
                    c.type = 'button';
                    c.className = 'mg-chip';
                    c.innerHTML = '<span></span><small></small>';
                    c.firstChild.textContent = it.label;
                    c.lastChild.textContent = it.count;
                    c.title = tr('Show on the wall') + ': ' + it.label;
                    c.addEventListener('click', function go() {
                        if (!guard('list', go)) return;
                        applyFilter(it.type, it.value);
                        $('searchInput').value = '';
                        syncSearchClear();
                        updateURL();
                        closeSearch();
                    });
                    chips.appendChild(c);
                });
                panel.appendChild(chips);
            }
        }
        const songs = q ? searchSongs(q, 60) : sectionSongs().slice(0, 300);
        const head = document.createElement('div');
        head.className = 'mg-results-head';
        head.textContent = q ? (songs.length ? tr('Songs') + ' · ' + songs.length + (songs.length >= 60 ? '+' : '')
                                             : tr('No songs match'))
                             : filterLabel(filter) + (S.get('shuffle') ? ' · ' + tr('Shuffle') : '') + ' · ' + visibleAlbums().length + ' ' + tr('songs');
        panel.appendChild(head);
        if (songs.length) {
            const ol = document.createElement('ol');
            ol.className = 'mg-rows';
            songs.forEach(function (a, i) {
                const row = songRow(a, { from: 'search', role: 'option', id: 'sr-' + i,
                    onPlay: function (album) { playOrQueue(album, { from: 'search', el: row.querySelector('img') }); if (isPhone()) closeSearch(); } });
                searchRows.push(row);
                ol.appendChild(row);
            });
            panel.appendChild(ol);
        }
        /* the Enter target: the top song, until the arrows pick another */
        if (q && searchRows.length) moveSearchSel(1);
        const foot = document.createElement('div');
        foot.className = 'mg-results-foot';
        foot.setAttribute('aria-hidden', 'true');
        const enterPlays = !currentAlbum;
        foot.innerHTML = '<span><kbd>↑</kbd><kbd>↓</kbd></span> <span><kbd>Enter</kbd> </span> <span><kbd>⇧ Enter</kbd> </span> <span><kbd>Esc</kbd> </span>';
        const spans = foot.querySelectorAll('span');
        spans[0].append(' ' + tr('Choose'));
        spans[1].append(enterPlays ? tr('Play now') : tr('Add to queue'));
        spans[2].append(enterPlays ? tr('Add to queue') : tr('Play now'));
        spans[3].append(tr('Close'));
        if (!coarse()) panel.appendChild(foot);
    }
    function moveSearchSel(d) {
        if (!searchRows.length) return;
        if (searchSel >= 0) { searchRows[searchSel].classList.remove('is-sel'); searchRows[searchSel].removeAttribute('aria-selected'); }
        searchSel = Math.max(0, Math.min(searchRows.length - 1, searchSel + d));
        const row = searchRows[searchSel];
        row.classList.add('is-sel');
        row.setAttribute('aria-selected', 'true');
        $('searchInput').setAttribute('aria-activedescendant', row.id);
        row.scrollIntoView({ block: 'nearest' });
    }
    function onSearchKey(e) {
        if (e.key === 'ArrowDown') { e.preventDefault(); openSearch(); moveSearchSel(1); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); moveSearchSel(-1); }
        else if (e.key === 'Escape') {
            e.preventDefault();
            if (searchOpen()) closeSearch();
            else if ($('searchInput').value) { $('searchInput').value = ''; syncSearchClear(); updateURL(); }
            else $('searchInput').blur();
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (!searchOpen()) openSearch();
            const row = searchRows[searchSel >= 0 ? searchSel : 0];
            const album = row && albumByUrl(row.dataset.url);
            if (!album) return;
            /* nothing playing: Enter plays; music on: Enter queues (Shift swaps) */
            const playIt = !currentAlbum !== e.shiftKey;
            if (playIt && locked() && currentAlbum && isPlaying) { enqueue(album, { from: 'search', el: row.querySelector('img') }); refreshRowState(row, album); }
            else if (playIt) { play(album, { from: 'search' }); if (isPhone()) closeSearch(); }
            else { enqueue(album, { from: 'search', el: row.querySelector('img') }); refreshRowState(row, album); }
        }
    }
    function syncSearchClear() { $('searchClear').hidden = !$('searchInput').value; }

    /* ══ Up next (the queue) ═══════════════════════════════════ */
    /* opts: { next: true → play next (front of the queue); from: who asked
       ('wall' | 'search' | 'api' | 'guest' …); el: where the cover flies from } */
    function enqueue(x, opts) {
        opts = opts || {};
        const album = toAlbum(x);
        if (!album) return false;
        /* nothing playing yet: it starts right away instead of waiting */
        if (!currentAlbum) { play(album, { from: opts.from || 'api' }); return true; }
        /* party lock: a guest's song joins the end of the line, and stays theirs to take out */
        if (locked()) {
            if (opts.next && queue.some(function (a) { return a.url === album.url; })) { toast(tr('Already in Up next'), album); return false; }
            opts = Object.assign({}, opts, { next: false });
        }
        const at = queue.findIndex(function (a) { return a.url === album.url; });
        if (opts.next) {
            if (at === 0) { toast(tr('Already next'), album); return false; }
            if (at > 0) queue.splice(at, 1);
            queue.unshift(album);
        } else {
            if (at >= 0) { toast(tr('Already in Up next'), album); return false; }
            if (queue.length >= QUEUE_MAX) { toast(tr('Up next is full')); return false; }
            queue.push(album);
        }
        if (locked()) guestAdds.add(album.url); else guestAdds.delete(album.url);
        queueChanged(opts.next ? 'next' : 'add', { album: album, from: opts.from || 'api' });
        flyToQueue(album, opts.el);
        toast(opts.next ? tr('Plays next') : tr('Added to Up next'), album);
        return true;
    }
    function removeAt(i) {
        if (i < 0 || i >= queue.length) return;
        const album = queue.splice(i, 1)[0];
        queueChanged('remove', { album: album });
    }
    function moveQueue(from, to) {
        if (from === to || from < 0 || from >= queue.length) return;
        to = Math.max(0, Math.min(queue.length - 1, to));
        const a = queue.splice(from, 1)[0];
        queue.splice(to, 0, a);
        queueChanged('move', { album: a });
        const row = $('queueList').children[to];
        if (row) { const f = row.querySelector('.q-main'); if (f && document.activeElement && document.activeElement.closest('#queueList')) f.focus(); }
    }
    function clearQueue() {
        if (!queue.length) return;
        queue = [];
        guestAdds.clear();
        queueChanged('clear', {});
    }
    function queueChanged(reason, extra) {
        renderQueue();
        updateURL();
        if (searchOpen()) searchRows.forEach(function (r) { const a = albumByUrl(r.dataset.url); if (a) refreshRowState(r, a); });
        MG.emit('queue', Object.assign({ queue: queue.slice(), reason: reason }, extra || {}));
    }

    let dragFrom = -1;
    function renderQueue() {
        const list = $('queueList');
        list.innerHTML = '';
        const n = queue.length;
        $('queueCount').textContent = n ? String(n) : '';
        $('queueEmpty').hidden = !!n;
        $('queueClear').hidden = !n;
        const badge = $('queueBadge');
        badge.hidden = !n;
        badge.textContent = n > 99 ? '99+' : String(n);
        $('queueBtn').setAttribute('aria-label', tr('Up next') + (n ? ' (' + n + ')' : ''));
        const fine = !coarse();
        queue.forEach(function (album, idx) {
            const st = splitTag(album);
            const li = document.createElement('li');
            li.className = 'mg-row q-row' + (guestAdds.has(album.url) ? ' guest' : '');
            li.dataset.url = album.url;
            li.dataset.idx = idx;
            if (fine) li.draggable = true;
            li.innerHTML =
                '<span class="q-grip" aria-hidden="true">' + svgIcon(ICON.grip) + '</span>' +
                '<button type="button" class="mg-row-main q-main"><img alt="" loading="lazy"><span class="mg-row-text"><span class="mg-row-title"></span><span class="mg-row-sub"></span></span></button>' +
                '<span class="mg-row-acts q-acts">' +
                '<button type="button" class="mg-icon-btn mg-row-btn q-up">' + svgIcon(ICON.up) + '</button>' +
                '<button type="button" class="mg-icon-btn mg-row-btn q-down">' + svgIcon(ICON.down) + '</button>' +
                '<button type="button" class="mg-icon-btn mg-row-btn q-rm">' + svgIcon(ICON.x) + '</button></span>';
            li.querySelector('img').src = cover(album);
            li.querySelector('.mg-row-title').textContent = st.title;
            li.querySelector('.mg-row-sub').textContent = countryMeta(album.country).flag + ' ' + st.artist;
            const main = li.querySelector('.q-main');
            main.title = tr('Play now') + ': ' + (album.tag || '');
            main.setAttribute('aria-label', (idx + 1) + '. ' + (album.tag || '') + ' — ' + tr('Play now'));
            const up = li.querySelector('.q-up'), down = li.querySelector('.q-down'), rm = li.querySelector('.q-rm');
            up.setAttribute('aria-label', tr('Move up') + ': ' + (album.tag || '')); up.title = tr('Move up');
            down.setAttribute('aria-label', tr('Move down') + ': ' + (album.tag || '')); down.title = tr('Move down');
            rm.setAttribute('aria-label', tr('Remove from queue') + ': ' + (album.tag || '')); rm.title = tr('Remove from queue');
            up.disabled = idx === 0;
            down.disabled = idx === n - 1;
            /* under the party lock these ask for the PIN (the row's own
               index may have moved by then, so they find the song again) */
            const at = function () { return queue.indexOf(album); };
            const mine = function () { return guestAdds.has(album.url); };
            main.addEventListener('click', function go() {
                if (isPlaying && !guard('skip', go)) return;
                const i = at();
                if (i < 0) return;
                queue.splice(i, 1);
                queueChanged('advance', { album: album });
                play(album, { from: 'queue' });
            });
            function moveBy(d) { return function go() { if (guard('queue', go) && at() >= 0) moveQueue(at(), at() + d); }; }
            function remove() { if ((mine() || guard('queue', remove)) && at() >= 0) removeAt(at()); }
            up.addEventListener('click', moveBy(-1));
            down.addEventListener('click', moveBy(1));
            rm.addEventListener('click', remove);
            /* keyboard: Alt+↑/↓ moves the song, Delete removes it */
            li.addEventListener('keydown', function (e) {
                if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) { e.preventDefault(); moveBy(e.key === 'ArrowUp' ? -1 : 1)(); }
                else if (e.key === 'Delete') { e.preventDefault(); remove(); }
            });
            if (fine) {
                li.addEventListener('dragstart', function (e) {
                    if (locked()) { e.preventDefault(); guard('queue'); return; }
                    dragFrom = idx;
                    li.classList.add('dragging');
                    e.dataTransfer.effectAllowed = 'move';
                    try { e.dataTransfer.setData('text/plain', album.url); } catch (err) {}
                });
                li.addEventListener('dragend', function () {
                    dragFrom = -1;
                    list.querySelectorAll('.drop-before,.drop-after,.dragging').forEach(function (r) { r.classList.remove('drop-before', 'drop-after', 'dragging'); });
                });
                li.addEventListener('dragover', function (e) {
                    if (dragFrom < 0) return;
                    e.preventDefault();
                    const r = li.getBoundingClientRect(), after = e.clientY > r.top + r.height / 2;
                    list.querySelectorAll('.drop-before,.drop-after').forEach(function (x) { x.classList.remove('drop-before', 'drop-after'); });
                    li.classList.add(after ? 'drop-after' : 'drop-before');
                });
                li.addEventListener('drop', function (e) {
                    if (dragFrom < 0) return;
                    e.preventDefault();
                    const r = li.getBoundingClientRect(), after = e.clientY > r.top + r.height / 2;
                    let to = idx + (after ? 1 : 0);
                    if (dragFrom < to) to--;
                    moveQueue(dragFrom, to);
                });
            }
            list.appendChild(li);
        });
        renderThen();
    }

    /* After Up next: what happens when it runs out */
    function renderThen() {
        const el = $('queueThen');
        el.innerHTML = '';
        const label = document.createElement('span');
        if (S.get('autoplay')) {
            label.textContent = (queue.length ? tr('Then') : tr('Next')) + ': ' + tr('Autoplay') + ' · ' +
                filterLabel(filter) + (S.get('shuffle') ? ' · ' + tr('Shuffle') : '');
            el.appendChild(label);
        } else {
            label.textContent = queue.length ? tr('Music stops after Up next.') : tr('Music stops after this song.');
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'mg-text-btn';
            b.textContent = tr('Turn on Autoplay');
            b.addEventListener('click', function go() { if (guard('settings', go)) S.set('autoplay', true); });
            el.append(label, ' ', b);
        }
    }

    /* A copy of the cover arcs from where it was queued to Up next (the row
       if the panel is open, else the Up next button), which pops as it lands. */
    function flyToQueue(album, from) {
        if (!from || reduced() || !document.body.animate) return;
        let target = null;
        if (panelShown()) target = $('queueList').querySelector('.q-row[data-url="' + CSS.escape(album.url) + '"] img');
        if (!target || !target.getBoundingClientRect().width) target = $('queueBtn');
        const a = from.getBoundingClientRect(), b = target.getBoundingClientRect();
        if (!a.width || !b.width) return;
        const size = Math.min(a.width, a.height, 160);
        const x0 = a.left + (a.width - size) / 2, y0 = a.top + (a.height - size) / 2;
        const dx = b.left + b.width / 2 - (x0 + size / 2), dy = b.top + b.height / 2 - (y0 + size / 2);
        const scale = Math.min(b.width, b.height) / size;
        const ghost = document.createElement('div');
        ghost.className = 'queue-fly';
        Object.assign(ghost.style, { left: x0 + 'px', top: y0 + 'px', width: size + 'px', height: size + 'px' });
        const img = document.createElement('div');
        img.style.backgroundImage = 'url(' + cover(album) + ')';
        ghost.appendChild(img);
        document.body.appendChild(ghost);
        const ms = 620;
        ghost.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(' + dx + 'px)' }],
                      { duration: ms, easing: 'cubic-bezier(0.25, 0.8, 0.4, 1)', fill: 'forwards' });
        const fly = img.animate([
            { transform: 'translateY(0) scale(1) rotate(0deg)', opacity: 1 },
            { transform: 'translateY(' + (dy * 0.35) + 'px) scale(' + ((1 + scale) / 2) + ') rotate(-8deg)', opacity: 1, offset: 0.5 },
            { transform: 'translateY(' + dy + 'px) scale(' + scale + ') rotate(0deg)', opacity: 0.8 },
        ], { duration: ms, easing: 'cubic-bezier(0.55, 0, 0.85, 0.5)', fill: 'forwards' });
        fly.onfinish = fly.oncancel = function () {
            ghost.remove();
            target.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.18)' }, { transform: 'scale(1)' }], { duration: 300, easing: 'ease-out' });
        };
    }

    /* ── Shuffle playlist (after the queue) ─────────────────── */
    /* The shuffled playlist of the wall's list; rebuilt when the list
       changes. played holds what this pass has already played. */
    function sectionKey() { return filter.type + ':' + (filter.value || ''); }
    function ensurePlaylist() {
        const key = sectionKey();
        if (playlist.key === key && playlist.order.length) return playlist;
        playlist = { key: key, order: shuffle(visibleAlbums()).map(function (a) { return a.url; }), played: new Set() };
        if (currentAlbum && playlist.order.includes(currentAlbum.url)) {
            playlist.order = [currentAlbum.url].concat(playlist.order.filter(function (u) { return u !== currentAlbum.url; }));
            playlist.played.add(currentAlbum.url);
        }
        return playlist;
    }
    function markPlayed(album) {
        if (playlist.key === sectionKey() && playlist.order.includes(album.url)) playlist.played.add(album.url);
    }
    function nextFromPlaylist() {
        const pl = ensurePlaylist();
        let url = pl.order.find(function (u) { return !pl.played.has(u) && !failed.has(u) && (!currentAlbum || u !== currentAlbum.url); });
        if (!url) {
            const pool = visibleAlbums().filter(function (a) { return !failed.has(a.url); });
            if (!pool.length) return null;
            const order = shuffle(pool).map(function (a) { return a.url; });
            if (currentAlbum && order.length > 1 && order[0] === currentAlbum.url) order.push(order.shift());
            playlist = { key: pl.key, order: order, played: new Set() };
            url = order.find(function (u) { return !currentAlbum || u !== currentAlbum.url; }) || order[0];
        }
        return albumByUrl(url);
    }
    function randomNext() {
        if (S.get('shuffle')) return nextFromPlaylist();
        const pool = visibleAlbums().filter(function (a) { return (!currentAlbum || a.url !== currentAlbum.url) && !failed.has(a.url); });
        return pool.length ? pool[Math.floor(Math.random() * pool.length)]
             : currentAlbum && !failed.has(currentAlbum.url) ? currentAlbum : null;
    }

    /* ══ Transport ═════════════════════════════════════════════ */
    /* Next: Up next first, then the shuffle. A song ending does the same
       when Autoplay is on (with it off, only Up next carries on). */
    /* opts.auto: the song ended or would not play (no fade-out needed) */
    function playNext(opts) {
        const fade = !(opts && opts.auto);
        /* songs that would not play this session are passed over */
        while (queue.length && failed.has(queue[0].url)) { const x = queue.shift(); guestAdds.delete(x.url); queueChanged('advance', { album: x }); }
        if (queue.length) {
            const a = queue.shift();
            guestAdds.delete(a.url);
            queueChanged('advance', { album: a });
            play(a, { from: 'queue', fade: fade });
            return;
        }
        const a = randomNext();
        if (a) play(a, { from: 'shuffle', fade: fade });
    }
    function advanceAfterEnd() {
        if (queue.length || S.get('autoplay')) playNext({ auto: true });
    }

    /* Previous restarts a song that is more than 3 s in, else steps back —
       and puts the current song at the front of Up next so Next returns. */
    const HISTORY_MAX = 50;
    let playHistory = [];
    function playPrevious() {
        const t0 = ytPlayer && typeof ytPlayer.getCurrentTime === 'function' ? ytPlayer.getCurrentTime() : 0;
        if (t0 > 3 || !playHistory.length) { seek(0); return; }
        const prev = playHistory.pop();
        if (currentAlbum && !queue.some(function (a) { return a.url === currentAlbum.url; })) {
            queue.unshift(currentAlbum);
            if (queue.length > QUEUE_MAX) queue.pop();
            queueChanged('next', { album: currentAlbum, from: 'history' });
        }
        play(prev, { from: 'history' });
    }
    function togglePlay() {
        if (!currentAlbum) { playNext(); return; }
        if (mediaDeferred === currentAlbum) { startMedia(currentAlbum); return; }
        if (!ytPlayer || typeof ytPlayer.getPlayerState !== 'function') return;
        if (ytPlayer.getPlayerState() === YT.PlayerState.PLAYING) ytPlayer.pauseVideo();
        else ytPlayer.playVideo();
    }
    /* The same, pressed by someone: under the party lock skipping and
       pausing ask for the PIN (playing when nothing plays never does). */
    function userNext() { if (guard('skip', userNext)) playNext(); }
    function userPrev() { if (currentAlbum && guard('skip', userPrev)) playPrevious(); }
    function userToggle() {
        if (isPlaying && !mediaDeferred && !guard('pause', userToggle)) return;
        togglePlay();
    }
    function userSeek(sec) { if (guard('seek', function () { userSeek(sec); })) seek(sec); }

    function seek(sec) {
        if (!ytPlayer || typeof ytPlayer.seekTo !== 'function') return;
        const d = duration();
        sec = Math.max(0, d ? Math.min(d - 0.5, sec) : sec);
        ytPlayer.seekTo(sec, true);
        tick(true);
    }
    function nowTime() { return ytPlayer && typeof ytPlayer.getCurrentTime === 'function' ? ytPlayer.getCurrentTime() || 0 : 0; }
    function duration() { return ytPlayer && typeof ytPlayer.getDuration === 'function' ? ytPlayer.getDuration() || 0 : 0; }

    /* ── YouTube IFrame API ─────────────────────────────────── */
    /* Nothing outside loads until a click: the API is fetched the first time
       a song plays, and a song restored from a link (?v=) waits in the
       player until Play is pressed. */
    let ytPlayer = null, ytReady = false, pendingVideo = null, ytRequested = false, mediaDeferred = null;
    window.onYouTubeIframeAPIReady = function () {
        ytReady = true;
        if (pendingVideo) { createYTPlayer(pendingVideo); pendingVideo = null; }
    };
    function ensureYTApi() {
        if (ytRequested) return;
        ytRequested = true;
        const s = document.createElement('script');
        s.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(s);
    }
    function createYTPlayer(videoId) {
        const slot = $('ytPlayerSlot');
        slot.innerHTML = '';
        const div = document.createElement('div');
        slot.appendChild(div);
        $('videoPlayer').classList.add('has-video');
        ytPlayer = new YT.Player(div, {
            host: 'https://www.youtube-nocookie.com',   /* no YouTube cookies until the visitor interacts */
            videoId: videoId,
            width: 640, height: 360,
            playerVars: { autoplay: 1, rel: 0, modestbranding: 1, playsinline: 1 },
            events: {
                onReady: function () { applySound(true); syncLyricsNow(); },
                onError: function (e) { onVideoError(e && e.data); },
                onStateChange: function (e) {
                    const P = YT.PlayerState;
                    const playing = e.data === P.PLAYING || e.data === P.BUFFERING;
                    if (e.data === P.PLAYING && fadeInArmed) { fadeInArmed = false; fadeTo(1, FADE_IN_MS); }
                    setPlaying(playing, e.data === P.PLAYING ? 'playing' : e.data === P.BUFFERING ? 'buffering'
                                      : e.data === P.ENDED ? 'ended' : 'paused');
                    if (e.data === P.ENDED) {
                        MG.emit('ended', { album: currentAlbum });
                        advanceAfterEnd();
                    } else if (!playing) {
                        tick(true);   /* paused/cued: show where it stopped */
                    }
                },
            },
        });
    }
    function loadVideo(videoId) {
        ensureYTApi();
        if (ytPlayer && typeof ytPlayer.loadVideoById === 'function') ytPlayer.loadVideoById(videoId);
        else if (ytReady) createYTPlayer(videoId);
        else pendingVideo = videoId;
    }

    /* ── Smooth transitions (setting 'smooth', on by default) ─ */
    /* A song skipped by hand fades out over FADE_OUT_MS before the next one
       loads; every song fades in over FADE_IN_MS. Only the YouTube player's
       volume moves (fadeLevel × the volume setting); the setting itself and
       the volume slider never do. Touching the volume ends a fade. */
    const FADE_OUT_MS = 350, FADE_IN_MS = 900;
    let fadeLevel = 1, fadeTimer = null, fadeTarget = 1, fadeDone = null, fadeInArmed = false, pendingLoad = null;
    function smoothOn() { return S.get('smooth') && !S.get('muted') && S.get('volume') > 0; }
    function playerVolume(v) { if (ytPlayer && typeof ytPlayer.setVolume === 'function') ytPlayer.setVolume(Math.round(v)); }
    function fadeTo(level, ms, done) {
        clearInterval(fadeTimer);
        const from = fadeLevel, t0 = performance.now();
        fadeTarget = level;
        fadeDone = done || null;
        fadeTimer = setInterval(function () {
            const k = Math.min(1, (performance.now() - t0) / ms);
            const e = k * k * (3 - 2 * k);   /* smoothstep */
            fadeLevel = from + (level - from) * e;
            playerVolume(S.get('volume') * fadeLevel);
            if (k >= 1) {
                clearInterval(fadeTimer); fadeTimer = null;
                const d = fadeDone; fadeDone = null;
                if (d) d();
            }
        }, 30);
    }
    /* the volume was touched (or smooth went off): no fade, a pending
       song loads now */
    function stopFade() {
        clearInterval(fadeTimer); fadeTimer = null;
        fadeLevel = 1; fadeTarget = 1; fadeInArmed = false;
        const d = fadeDone; fadeDone = null;
        if (d) d();
    }
    /* Loads a new song into the player, fading the old one out first when
       it was skipped by hand while playing. */
    function switchVideo(videoId, fadeOut) {
        if (fadeOut && isPlaying && smoothOn() && ytPlayer && typeof ytPlayer.setVolume === 'function') {
            pendingLoad = videoId;
            if (!(fadeTimer && fadeTarget === 0)) fadeTo(0, FADE_OUT_MS * fadeLevel, function () {
                const v = pendingLoad; pendingLoad = null;
                if (v) startVideo(v);
            });
            return;
        }
        if (fadeTimer && fadeTarget === 0) { clearInterval(fadeTimer); fadeTimer = null; fadeDone = null; }
        pendingLoad = null;
        startVideo(videoId);
    }
    function startVideo(videoId) {
        if (smoothOn()) {
            clearInterval(fadeTimer); fadeTimer = null;
            fadeLevel = 0; fadeInArmed = true;
            playerVolume(0);   /* a new player starts silent from onReady */
        } else { fadeLevel = 1; fadeInArmed = false; }
        stallReset();
        loadVideo(videoId);
    }

    /* ── Songs that won't play ──────────────────────────────── */
    /* YouTube onError (2 bad id, 5 HTML5 player error, 100 removed or
       private, 101/150 no embedding): skip to the next song with a toast,
       and remember it for this session so the shuffle and Up next pass it
       over. A song whose clock stops for STALL_MS while it should be
       playing is reloaded once where it stopped, then skipped. After
       FAIL_MAX failures in a row (the connection is likely down) the music
       stops instead of racing through the list. */
    const failed = new Set();
    const FAIL_MAX = 5;
    let failStreak = 0;
    const STALL_MS = 15000, STALL_START_MS = 40000;   /* at 0:00 an ad may be running */
    let stall = { url: '', t: -1, since: 0, retried: false };
    function stallMs(atStart) { const tu = MG.tuning || {}; return atStart ? (tu.stallStartMs || STALL_START_MS) : (tu.stallMs || STALL_MS); }
    function stallReset() { stall = { url: currentAlbum ? currentAlbum.url : '', t: -1, since: performance.now(), retried: false }; }
    function onVideoError(code) {
        if (!currentAlbum || mediaDeferred || pendingLoad) return;   /* pendingLoad: the old song, fading out */
        skipUnavailable(currentAlbum, 'error', code);
    }
    function skipUnavailable(album, reason, code) {
        failed.add(album.url);
        failStreak++;
        MG.emit('unavailable', { album: album, reason: reason, code: code == null ? null : code });
        const title = splitTag(album).title;
        if (failStreak > FAIL_MAX) {
            toast(tr('Several songs in a row would not play. Check the connection.'));
            if (ytPlayer && typeof ytPlayer.stopVideo === 'function') ytPlayer.stopVideo();
            setPlaying(false, 'paused');
            failStreak = 0;
            return;
        }
        playNext({ auto: true });
        toast(tr('Skipped'), album, title + ' — ' + tr('not available'));
    }
    /* called on every tick while the music should be playing */
    function checkStall(cur) {
        if (!currentAlbum || pendingLoad || mediaDeferred || !isPlaying) return;
        const now = performance.now();
        if (stall.url !== currentAlbum.url) { stallReset(); stall.t = cur; return; }
        if (Math.abs(cur - stall.t) > 0.05) { stall.t = cur; stall.since = now; if (cur > 3) failStreak = 0; return; }
        if (now - stall.since < stallMs(cur < 0.5)) return;
        stall.since = now;
        if (!stall.retried) {
            stall.retried = true;
            MG.emit('stall', { album: currentAlbum });
            toast(tr('Stuck — trying again'), currentAlbum);
            if (ytPlayer && typeof ytPlayer.loadVideoById === 'function') ytPlayer.loadVideoById({ videoId: currentAlbum.url, startSeconds: Math.max(0, cur - 1) });
            return;
        }
        skipUnavailable(currentAlbum, 'stall', null);
    }

    /* One clock for the progress bar and the lyrics: 10 Hz while playing
       (the lyrics need it), the time event about 4× a second. */
    let ticker = null, tickN = 0, seeking = false;
    function setPlaying(on, state) {
        if (on && !isPlaying) stall.since = performance.now();   /* the clock starts over */
        isPlaying = on;
        const btn = $('playBtn');
        btn.classList.toggle('is-playing', on);
        const label = on ? tr('Pause') : tr('Play');
        btn.setAttribute('aria-label', label);
        btn.title = label + ' (Space)';
        $('lyricsSection').classList.toggle('playing', on);
        document.body.classList.toggle('mg-playing', on);
        clearInterval(ticker);
        ticker = on ? setInterval(tick, 100) : null;
        tick(true);
        MG.emit('playstate', { playing: on, state: state });
    }
    function tick(force) {
        syncLyricsNow();
        if (isPlaying) checkStall(nowTime());
        if (!force && (tickN++ % 3)) return;
        const d = duration(), cur = nowTime();
        if (!seeking) {
            const bar = $('seekBar');
            bar.value = d ? Math.round(cur / d * 1000) : 0;
            bar.style.setProperty('--pct', (d ? cur / d * 100 : 0) + '%');
            bar.setAttribute('aria-valuetext', fmtTime(cur) + ' / ' + fmtTime(d));
            $('timeNow').textContent = fmtTime(cur);
        }
        $('timeTotal').textContent = fmtTime(d);
        $('seekBar').disabled = !d;
        MG.emit('time', { time: cur, duration: d });
    }

    /* ── Sound ──────────────────────────────────────────────── */
    /* keepFade: the player just got ready mid-fade (it starts at fadeLevel);
       otherwise any fade ends and the volume is the setting */
    function applySound(keepFade) {
        const muted = S.get('muted'), vol = S.get('volume');
        if (!keepFade || !smoothOn()) stopFade();
        if (ytPlayer && typeof ytPlayer.setVolume === 'function') {
            ytPlayer.setVolume(Math.round(vol * fadeLevel));
            if (muted || !vol) ytPlayer.mute(); else ytPlayer.unMute();
        }
        const silent = muted || !vol;
        const b = $('muteBtn');
        b.setAttribute('aria-pressed', silent ? 'true' : 'false');
        b.classList.toggle('is-muted', silent);
        const label = silent ? tr('Unmute') : tr('Mute');
        b.setAttribute('aria-label', label);
        b.title = label + ' (M)';
        [$('volumeBar'), $('setVolume')].forEach(function (r) {
            r.value = vol;
            r.style.setProperty('--pct', (silent ? 0 : vol) + '%');
            r.setAttribute('aria-valuetext', silent ? tr('Muted') : vol + '%');
        });
        $('setSound').checked = !muted;
        $('setVolumeVal').textContent = silent ? tr('Muted') : vol + '%';
    }
    function toggleMute() {
        if (!S.get('muted') && !S.get('volume')) { S.set('volume', 60); return; }
        S.set('muted', !S.get('muted'));
    }
    function setVolume(v) {
        S.set('volume', v);
        if (v > 0 && S.get('muted')) S.set('muted', false);
    }

    /* ══ Now playing ═══════════════════════════════════════════ */
    function play(x, opts) {
        const album = toAlbum(x);
        if (!album) return;
        opts = opts || {};
        if (currentAlbum && currentAlbum.url !== album.url && opts.from !== 'history') {
            playHistory.push(currentAlbum);
            if (playHistory.length > HISTORY_MAX) playHistory.shift();
        }
        if (opts.from !== 'wall') setActiveCell(null);
        /* a song played from anywhere leaves Up next */
        const inQ = queue.findIndex(function (a) { return a.url === album.url; });
        if (inQ >= 0 && opts.from !== 'history') { queue.splice(inQ, 1); queueChanged('advance', { album: album }); }
        currentAlbum = album;
        markPlayed(album);
        clearLyrics();
        setLyricsOffset(readOffsets()[album.url] || 0, false);
        mediaDeferred = opts.defer ? album : null;
        /* by hand while something plays: fade out first (opts.fade false:
           the song ended or failed) */
        if (!mediaDeferred) { loadLyrics(album); switchVideo(album.url, opts.fade !== false); }
        renderNow(album);
        updateURL();
        renderQueue();
        if (searchOpen()) searchRows.forEach(function (r) { r.classList.toggle('playing', r.dataset.url === album.url); });
        /* the panel opens on the first song (desktop); a phone keeps the wall */
        if (!panelHidden && !isPhone()) setPanel(true);
        syncChrome();
        MG.emit('track', { album: album, deferred: !!mediaDeferred, from: opts.from || 'api' });
    }
    function startMedia(album) {
        mediaDeferred = null;
        $('videoPlayer').classList.remove('deferred');
        loadLyrics(album);
        startVideo(album.url);
        syncChrome();
        MG.emit('track', { album: album, deferred: false, from: 'url' });
    }

    function renderNow(album) {
        const st = splitTag(album);
        /* player bar */
        const pc = $('pbCover');
        pc.innerHTML = '';
        const img = document.createElement('img');
        img.src = cover(album); img.alt = '';
        pc.appendChild(img);
        $('pbTitle').textContent = st.title;
        $('pbArtist').textContent = st.artist;
        $('pbNow').title = tr('Now playing') + ': ' + (album.tag || '');
        /* panel */
        $('videoPosterImg').src = cover(album);
        const ai = $('albumImage');
        ai.innerHTML = '';
        const im2 = document.createElement('img');
        im2.src = cover(album); im2.alt = tr('Album cover');
        ai.appendChild(im2);
        $('videoTitle').textContent = st.title;
        $('videoArtist').textContent = st.artist;
        /* chips: country · genre · mood · party · meme — each shows that list */
        const metaEl = $('videoMeta');
        metaEl.innerHTML = '';
        [
            album.country ? { type: 'country', value: album.country, label: countryLabel(album.country) } : null,
            album.genre   ? { type: 'genre',   value: album.genre,   label: genreLabel(album.genre) } : null,
            album.mood    ? { type: 'mood',    value: album.mood,    label: moodLabel(album.mood) } : null,
        ].concat((album.party || []).map(function (id) { return { type: 'party', value: id, label: partyLabel(id) }; }))
         .concat([album.meme ? { type: 'meme', value: '', label: '😂 ' + tr('Meme') } : null])
         .filter(Boolean).forEach(function (chip) {
            const c = document.createElement('button');
            c.type = 'button';
            c.className = 'meta-chip';
            c.textContent = chip.label;
            c.title = tr('Show on the wall') + ': ' + chip.label;
            c.addEventListener('click', function go() { if (guard('list', go)) applyFilter(chip.type, chip.value); });
            metaEl.appendChild(c);
        });
        /* streaming links: a real id when there is one, else a search by tag */
        const linksEl = $('videoLinks');
        linksEl.innerHTML = '';
        const q = encodeURIComponent((album.tag || '').replace(/\s*—\s*/g, ' '));
        [
            { label: 'YouTube', href: 'https://www.youtube.com/watch?v=' + album.url, platform: 'youtube' },
            { label: 'Spotify', href: album.spotifyurl ? 'https://open.spotify.com/track/' + album.spotifyurl : 'https://open.spotify.com/search/' + q, platform: 'spotify' },
            { label: 'Apple Music', href: album.applemusicurl ? 'https://geo.music.apple.com/' + album.applemusicurl : 'https://geo.music.apple.com/us/search?term=' + q, platform: 'apple' },
        ].forEach(function (l) {
            const a = document.createElement('a');
            a.href = l.href; a.target = '_blank'; a.rel = 'noopener noreferrer';
            a.textContent = l.label;
            a.dataset.platform = l.platform;
            linksEl.appendChild(a);
        });
        $('videoPlayer').classList.toggle('deferred', mediaDeferred === album);
    }

    /* Panel: open beside the wall (desktop) or as a sheet over it (phone).
       Hidden, it slides off but stays rendered, so the video keeps playing. */
    function panelShown() { return document.body.classList.contains('np-open'); }
    function setPanel(open) {
        open = !!open && !!currentAlbum;
        document.body.classList.toggle('np-open', open);
        $('nowPanel').setAttribute('aria-hidden', open ? 'false' : 'true');
        $('nowPanel').inert = !open;
        ['pbNow', 'queueBtn'].forEach(function (id) { $(id).setAttribute('aria-expanded', open ? 'true' : 'false'); });
    }
    function togglePanel(user) {
        if (!currentAlbum) { toast(tr('Nothing playing yet — pick a cover or search.')); return; }
        const open = !panelShown();
        if (user && !isPhone()) panelHidden = !open;
        if (open) closeSearch();
        setPanel(open);
        if (open && isPhone()) $('npHide').focus();
    }

    /* Everything that depends on whether a song is loaded */
    function syncChrome() {
        const has = !!currentAlbum;
        document.body.classList.toggle('mg-has-song', has);
        $('prevBtn').disabled = !has;
        if (!has) {
            $('pbCover').innerHTML = svgIcon('<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>');
            $('pbTitle').textContent = tr('Nothing playing');
            $('pbArtist').textContent = tr('Press ▶ to shuffle:') + ' ' + (filter.type === 'all' ? tr('All songs') : filterLabel(filter));
        }
        syncLyricsUI();
    }

    /* ══ Lyrics ════════════════════════════════════════════════ */
    /* Source: the song's LRCLIB record (catalog field "lrclib"), fetched
       from lrclib.net at play time. Lyrics are copyrighted, so the site
       never hosts them; the catalog keeps only the record id.
       LRC: [MM:SS.xx]Original | Translation (hundredths or ms). */
    function parseLRC(text) {
        const re = /^\[(\d{1,2}):(\d{2})\.(\d{2,3})\](.*)$/;
        const cues = [];
        const om = text.match(/^\[offset:\s*([+-]?\d+)\s*\]/mi);   /* + shows every line sooner */
        const shift = om ? parseInt(om[1], 10) / 1000 : 0;
        text.split('\n').forEach(function (line) {
            const m = line.match(re);
            if (!m) return;
            const time = parseInt(m[1], 10) * 60 + parseInt(m[2], 10) + parseInt(m[3], 10) / (m[3].length === 2 ? 100 : 1000);
            const content = m[4].trim(), sep = content.indexOf(' | ');
            cues.push({ time: time - shift,
                        original: sep >= 0 ? content.slice(0, sep).trim() : content,
                        translation: sep >= 0 ? content.slice(sep + 3).trim() : '' });
        });
        return cues.sort(function (a, b) { return a.time - b.time; });
    }

    /* The stage shows over the wall when lyrics are on and the song has
       lyrics — or, with none, music notes or a dancing mascot. */
    function syncLyricsUI() {
        const on = S.get('lyrics');
        [$('lyricsBtn'), $('npLyricsBtn')].forEach(function (b) {
            b.setAttribute('aria-pressed', on ? 'true' : 'false');
            const label = on ? tr('Hide lyrics') : tr('Show lyrics');
            b.setAttribute('aria-label', label);
            b.title = label + ' (L)';
        });
        $('lyricsBtn').disabled = !currentAlbum;
        $('setLyrics').checked = on;
        const show = on && !!currentAlbum && (lyricsData.length > 0 || lyricsNotes);
        const was = document.body.classList.contains('mg-lyrics');
        document.body.classList.toggle('mg-lyrics', show);
        $('lyricsSection').setAttribute('aria-hidden', show ? 'false' : 'true');
        $('lyricsSection').inert = !show;
        if (show && !was && lyricsCueIdx >= 0) requestAnimationFrame(function () { highlightLine(lyricsCueIdx); });
    }
    function toggleLyrics() { S.set('lyrics', !S.get('lyrics')); }

    function buildLyricsPanel(cues) {
        lyricsData = cues;
        lyricsCueIdx = -1;
        lyricsNotes = false;
        /* the mascot moves aside: it dances on the right, behind the lyrics */
        if (window.MGDancer) MGDancer.show(currentAlbum, $('lyricsSection'), { side: true });
        $('lyricsSection').classList.remove('no-lyrics', 'gap');
        const container = $('lyricsContainer');
        container.innerHTML = '';
        cues.forEach(function (cue, idx) {
            const line = document.createElement('div');
            line.className = 'lyric-line';
            line.dataset.idx = idx;
            line.addEventListener('click', function go() { if (guard('seek', go)) seekToCue(idx); });
            const orig = document.createElement('div');
            orig.className = 'lyric-original';
            orig.textContent = cue.original;
            line.appendChild(orig);
            if (cue.translation) {
                const trn = document.createElement('div');
                trn.className = 'lyric-translation';
                trn.textContent = cue.translation;
                line.appendChild(trn);
            }
            container.appendChild(line);
        });
        syncLyricsUI();
        MG.emit('lyrics', { cues: cues.slice(), notes: false });
    }
    function clearLyrics() {
        lyricsData = [];
        lyricsCueIdx = -1;
        lyricsNotes = false;
        clearTimeout(notesTimer);
        if (window.MGDancer) MGDancer.hide();
        $('lyricsContainer').innerHTML = '';
        $('lyricsSection').classList.remove('no-lyrics', 'gap');
        syncLyricsUI();
    }

    /* Music notes drift over the stage when nothing has been sung for
       NOTES_AFTER seconds (no lyrics, a long intro, break or outro); they
       give way NOTES_LEAD seconds before the next line. */
    const NOTES_AFTER = 3, NOTES_LEAD = 1;
    const NOTE_SVG = [
        '<svg viewBox="0 0 24 24"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
        '<svg viewBox="0 0 24 24"><circle cx="8" cy="18" r="4"/><path d="M12 18V2l7 4"/></svg>',
    ];
    function ensureNotes() {
        const section = $('lyricsSection');
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
        if (window.MGDancer) MGDancer.show(currentAlbum, $('lyricsSection'));
        $('lyricsSection').classList.add('no-lyrics', 'gap');
        syncLyricsUI();
        MG.emit('lyrics', { cues: [], notes: true });
    }
    const GAP_LINE = /^[\s♪♫…・.\-–—]*$|^[(（[]\s*(instrumental|interlude|intro|outro|solo|music|break|間奏)[^)）\]]*[)）\]]$/i;
    function updateGap(time) {
        const cur = lyricsData[lyricsCueIdx];
        if (cur && !GAP_LINE.test(cur.original)) { setGap(false); return; }
        const since = cur ? cur.time : 0, next = lyricsData[lyricsCueIdx + 1];
        setGap(time - since >= NOTES_AFTER && (!next || next.time - time >= NOTES_LEAD));
    }
    function setGap(on) {
        const section = $('lyricsSection');
        if (section.classList.contains('gap') === on) return;
        if (on) ensureNotes();
        section.classList.toggle('gap', on);
    }
    /* Scrolls only the lyrics box (scrollIntoView would walk every ancestor) */
    function highlightLine(idx) {
        const container = $('lyricsContainer');
        const prev = container.querySelector('.lyric-line.current');
        if (prev) prev.classList.remove('current');
        const el = idx >= 0 ? container.children[idx] : null;
        if (!el || !el.classList.contains('lyric-line')) return;
        el.classList.add('current');
        const box = container.getBoundingClientRect(), r = el.getBoundingClientRect();
        if (!box.height) return;
        container.scrollTo({ top: container.scrollTop + r.top - box.top - (box.height - r.height) / 2,
                             behavior: reduced() ? 'auto' : 'smooth' });
    }
    /* Jump the song to a lyric line (lyrics time, so the offset comes off;
       a hair past the cue so the sync lands on this line) */
    function seekToCue(idx) {
        const cue = lyricsData[idx];
        if (!cue || !ytPlayer || typeof ytPlayer.seekTo !== 'function') return;
        ytPlayer.seekTo(Math.max(0, cue.time - lyricsOffset + 0.05), true);
        if (typeof ytPlayer.playVideo === 'function') ytPlayer.playVideo();
        lyricsCueIdx = idx;
        highlightLine(idx);
    }
    function syncLyricsNow() {
        if (!lyricsData.length || !ytPlayer || typeof ytPlayer.getCurrentTime !== 'function') return;
        const time = ytPlayer.getCurrentTime() + lyricsOffset;
        let idx = -1;
        for (let i = 0; i < lyricsData.length; i++) { if (lyricsData[i].time <= time) idx = i; else break; }
        if (idx !== lyricsCueIdx) {
            lyricsCueIdx = idx;
            highlightLine(idx);
            MG.emit('lyricline', { index: idx, cue: lyricsData[idx] || null });
        }
        updateGap(time);
    }

    /* Lyrics timing, remembered per song. Step 0.25 s, ±10 s. */
    const LYRICS_OFFSET_STEP = 0.25, LYRICS_OFFSET_MAX = 10;
    function readOffsets() {
        try { return JSON.parse(localStorage.getItem('mg_lyrics_offsets') || '{}') || {}; } catch (e) { return {}; }
    }
    function setLyricsOffset(sec, save) {
        sec = Math.round(Math.min(LYRICS_OFFSET_MAX, Math.max(-LYRICS_OFFSET_MAX, +sec || 0)) * 100) / 100;
        lyricsOffset = sec;
        $('lyricsOffsetVal').textContent = (sec > 0 ? '+' : sec < 0 ? '−' : '±') + Math.abs(sec).toFixed(2) + 's';
        $('lyricsOffset').classList.toggle('shifted', sec !== 0);
        $('lyricsLater').disabled = sec <= -LYRICS_OFFSET_MAX;
        $('lyricsSooner').disabled = sec >= LYRICS_OFFSET_MAX;
        if (save && currentAlbum) {
            const all = readOffsets();
            if (sec) all[currentAlbum.url] = sec; else delete all[currentAlbum.url];
            try { localStorage.setItem('mg_lyrics_offsets', JSON.stringify(all)); } catch (e) {}
        }
        MG.emit('lyricsoffset', { offset: sec });
        syncLyricsNow();
    }

    function loadLyrics(album) {
        notesTimer = setTimeout(function () {
            if (currentAlbum === album && !lyricsData.length) showLyricsNotes();
        }, NOTES_AFTER * 1000);
        if (album.lrclib) fetchLyrics(album).then(function (text) {
            if (currentAlbum !== album) return;
            const cues = parseLRC(text);
            if (!cues.length) throw 0;
            clearTimeout(notesTimer);
            buildLyricsPanel(cues);
            syncLyricsNow();
        }).catch(function () {});   /* no lyrics: notesTimer brings the notes */
    }

    /* Each visitor keeps the lyrics they have played in their own
       localStorage (a private copy, never sent anywhere), so a song plays
       with lyrics even while LRCLIB is down; 503 "busy" and network errors
       are retried a few times, stopping once another song takes over. */
    const LRC_CACHE_PREFIX = 'mg_lrc_', LRC_CACHE_INDEX = 'mg_lrc_index', LRC_CACHE_MAX = 150;
    const LRC_RETRY_DELAYS = [1500, 4000, 9000];
    function lrcCacheGet(id) {
        try { const text = localStorage.getItem(LRC_CACHE_PREFIX + id); if (text) lrcCacheTouch(id); return text; }
        catch (e) { return null; }
    }
    function lrcCacheTouch(id) {
        try {
            let ids = JSON.parse(localStorage.getItem(LRC_CACHE_INDEX) || '[]');
            ids = ids.filter(function (x) { return x !== id; });
            ids.push(id);
            while (ids.length > LRC_CACHE_MAX) localStorage.removeItem(LRC_CACHE_PREFIX + ids.shift());
            localStorage.setItem(LRC_CACHE_INDEX, JSON.stringify(ids));
        } catch (e) {}
    }
    function lrcCachePut(id, text) {
        try { localStorage.setItem(LRC_CACHE_PREFIX + id, text); lrcCacheTouch(id); } catch (e) {}
    }
    function fetchLyrics(album) {
        const id = String(album.lrclib);
        const cached = lrcCacheGet(id);
        if (cached) return Promise.resolve(cached);
        function attempt(n) {
            return fetch('https://lrclib.net/api/get/' + encodeURIComponent(id))
                .then(function (r) {
                    if (r.ok) return r.json();
                    throw { retry: r.status === 429 || r.status >= 500 };
                }, function () { throw { retry: true }; })
                .then(function (rec) {
                    const text = (rec && rec.syncedLyrics) || '';
                    if (text) lrcCachePut(id, text);
                    return text;
                }, function (err) {
                    if (!err || !err.retry || n >= LRC_RETRY_DELAYS.length) throw 0;
                    return new Promise(function (resolve) { setTimeout(resolve, LRC_RETRY_DELAYS[n]); })
                        .then(function () { if (currentAlbum !== album) throw 0; return attempt(n + 1); });
                });
        }
        return attempt(0);
    }

    /* ══ Settings, help, toast ═════════════════════════════════ */
    let lastFocus = null;
    function openModal(id) {
        const scrim = $(id);
        if (!scrim.hidden) return;
        closeSearch(); closeLists();
        if (!anyModalOpen()) lastFocus = document.activeElement;
        scrim.hidden = false;
        holdWall++;
        if (id === 'settingsScrim') {
            syncSettings();
            if (window.MGDancer && MGDancer.mount) MGDancer.mount($('mascotHost'));
            $('settingsX').focus();
        } else $('helpOk').focus();
    }
    function closeModal(id) {
        const scrim = $(id);
        if (scrim.hidden) return;
        scrim.hidden = true;
        holdWall = Math.max(0, holdWall - 1);
        if (id === 'settingsScrim' && window.MGDancer && MGDancer.unmount) MGDancer.unmount();
        if (!anyModalOpen() && lastFocus && lastFocus.focus && lastFocus !== document.body && document.contains(lastFocus)) lastFocus.focus();
    }
    function anyModalOpen() { return !$('settingsScrim').hidden || !$('helpScrim').hidden; }
    function syncSettings() {
        $('setAutoplay').checked = S.get('autoplay');
        $('setShuffle').checked = S.get('shuffle');
        $('setLyrics').checked = S.get('lyrics');
        $('setWall').checked = S.get('wallMotion');
        $('setSmooth').checked = S.get('smooth');
        applySound();
    }
    /* keep Tab inside an open dialog */
    function trapFocus(e) {
        if (e.key !== 'Tab') return;
        const scrim = !$('helpScrim').hidden ? $('helpScrim') : !$('settingsScrim').hidden ? $('settingsScrim')
                    : listsOpen() ? listsUI.panel : null;
        if (!scrim) return;
        const f = Array.prototype.filter.call(scrim.querySelectorAll('button,input,a[href],[tabindex]:not([tabindex="-1"])'),
            function (el) { return !el.disabled && el.offsetParent !== null; });
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        else if (!scrim.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
    }

    let toastTimer = null;
    /* msg in bold; with an album, its cover and title (or detail) after it */
    function toast(msg, album, detail) {
        const el = $('toast');
        el.textContent = '';
        if (album) {
            const img = document.createElement('img');
            img.src = cover(album); img.alt = '';
            const b = document.createElement('b');
            b.textContent = msg;
            const s = document.createElement('span');
            s.textContent = detail || splitTag(album).title;
            el.append(img, b, s);
        } else el.textContent = msg;
        el.hidden = false;
        requestAnimationFrame(function () { el.classList.add('show'); });
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () {
            el.classList.remove('show');
            setTimeout(function () { if (!el.classList.contains('show')) el.hidden = true; }, 250);
        }, 2200);
    }

    function toggleFullscreen() {
        const d = document, e = d.documentElement;
        if (d.fullscreenElement) { if (d.exitFullscreen) d.exitFullscreen(); return; }
        if (e.requestFullscreen) e.requestFullscreen().catch(function () {});
    }

    /* ── Keys ───────────────────────────────────────────────── */
    /* / search · Space or K play/pause · N next · B previous · ←/→ 5 s ·
       Q Now playing · L lyrics · M sound · P the wall · F fullscreen ·
       D the TV display (Shift+D: its next mode) ·
       ? or H help · Esc closes. Never while typing. */
    function wireKeys() {
        document.addEventListener('keydown', function (e) {
            trapFocus(e);
            if (e.metaKey || e.ctrlKey || e.altKey) return;
            const tg = e.target;
            const typing = tg && (tg.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(tg.tagName || '')) &&
                           !(tg.type === 'range' || tg.type === 'checkbox');
            const k = e.key;
            if (k === 'Escape') {
                if (!$('helpScrim').hidden) { closeModal('helpScrim'); return; }
                if (!$('settingsScrim').hidden) { closeModal('settingsScrim'); return; }
                if (listsOpen()) { closeLists(); return; }
                if (searchOpen()) { closeSearch(); return; }
                if (isPhone() && panelShown()) { setPanel(false); return; }
                return;
            }
            if (typing || e.repeat && k !== 'ArrowLeft' && k !== 'ArrowRight') return;
            if (anyModalOpen()) {
                if (!$('helpScrim').hidden && (k === '?' || k === 'h' || k === 'H')) { e.preventDefault(); closeModal('helpScrim'); }
                return;
            }
            if (listsOpen()) return;
            const onControl = tg && /^(BUTTON|A|INPUT)$/.test(tg.tagName || '');
            if (k === '/') { e.preventDefault(); $('searchInput').focus(); $('searchInput').select(); openSearch(); }
            else if (k === '?' || k === 'h' || k === 'H') { e.preventDefault(); openModal('helpScrim'); }
            /* under the party lock, what guests may not do asks for the PIN */
            else if ((k === ' ' && !onControl) || k === 'k' || k === 'K') { e.preventDefault(); userToggle(); }
            else if (k === 'n' || k === 'N') userNext();
            else if (k === 'b' || k === 'B') userPrev();
            else if ((k === 'ArrowRight' || k === 'ArrowLeft') && !(tg && tg.type === 'range') && currentAlbum && !mediaDeferred) {
                e.preventDefault(); userSeek(nowTime() + (k === 'ArrowRight' ? 5 : -5));
            }
            else if (k === 'q' || k === 'Q') togglePanel(true);
            else if (k === 'l' || k === 'L') { if (guard('settings', toggleLyrics)) toggleLyrics(); }
            else if (k === 'm' || k === 'M') { if (guard('sound', toggleMute)) toggleMute(); }
            else if (k === 'p' || k === 'P') { if (guard('settings')) S.set('wallMotion', !S.get('wallMotion')); }
            else if (k === 'f' || k === 'F') toggleFullscreen();
            else if ((k === 'd' || k === 'D') && MG.display) {   /* the TV display; Shift: its next mode */
                const sh = e.shiftKey;
                const go = function () { if (sh) MG.display.cycleMode(); else MG.display.open(); };
                if (guard('display', go)) go();
            }
        });
    }

    /* Labels that are built in JS follow a language change */
    function relabel() {
        $('searchInput').placeholder = tr(isPhone() ? 'Search songs…' : 'Search songs, artists, countries…');
        $('prevBtn').title = tr('Previous') + ' (B)';
        $('nextBtn').title = tr('Next') + ' (N)';
        $('queueBtn').title = tr('Up next') + ' (Q)';
        $('npHide').title = tr('Hide the player panel') + ' (Q)';
        syncScopeUI();
        syncLyricsUI();
        applySound();
        setPlaying(isPlaying, isPlaying ? 'playing' : 'paused');
        renderQueue();
        if (currentAlbum) renderNow(currentAlbum);
        syncChrome();
        buildIndex();
        if (searchOpen()) renderSearch();
    }

    /* ══ Init ══════════════════════════════════════════════════ */
    document.addEventListener('DOMContentLoaded', function () {
        const grid = $('musicgrid');
        if (!grid || typeof albums === 'undefined') { console.error('MusicGrid: catalog or wall missing.'); return; }

        const cat = new URLSearchParams(location.search).get('cat');
        if (cat) filter = decodeFilter(cat);

        /* wall */
        grid.addEventListener('click', onGridClick);
        grid.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') hoverWall = true; });
        grid.addEventListener('pointerleave', function () { hoverWall = false; });
        grid.addEventListener('scroll', function () {
            if (grid.scrollTop + grid.clientHeight >= grid.scrollHeight - grid.clientHeight * 0.5) {
                populateGrid(grid); ensureScrollable(grid); trimGrid(grid);
            }
        }, { passive: true });
        /* aspect-ratio in a CSS grid can stick until a resize: flip and
           restore in one frame (the offsetWidth read forces the layout) */
        if (window.ResizeObserver) new ResizeObserver(function () {
            grid.style.gridTemplateColumns = 'none';
            void grid.offsetWidth;
            grid.style.gridTemplateColumns = '';
        }).observe(grid);

        /* toolbar */
        $('scopeAll').addEventListener('click', function go() { if (guard('list', go)) applyFilter('all', ''); });
        $('scopeCarino').addEventListener('click', function go() { if (guard('list', go)) applyFilter('carino', ''); });
        $('scopeLists').addEventListener('click', function (e) { e.stopPropagation(); if (guard('list', openLists)) openLists(); });
        if (!albums.some(function (a) { return a.carino; })) $('scopeCarino').hidden = true;
        const input = $('searchInput');
        let urlTimer = null;
        input.addEventListener('input', function () {
            syncSearchClear();
            openSearch();
            renderSearch();
            clearTimeout(urlTimer);
            urlTimer = setTimeout(updateURL, 400);
        });
        input.addEventListener('focus', openSearch);
        input.addEventListener('click', openSearch);
        input.addEventListener('keydown', onSearchKey);
        $('searchClear').addEventListener('click', function () {
            input.value = ''; syncSearchClear(); updateURL(); input.focus(); renderSearch();
        });
        /* a click outside search closes it */
        document.addEventListener('pointerdown', function (e) {
            if (!searchOpen()) return;
            if (e.target.closest('#searchPanel') || e.target.closest('#searchBox')) return;
            closeSearch();
        });

        /* player bar */
        $('playBtn').addEventListener('click', userToggle);
        $('nextBtn').addEventListener('click', userNext);
        $('prevBtn').addEventListener('click', userPrev);
        $('pbNow').addEventListener('click', function () { togglePanel(true); });
        $('queueBtn').addEventListener('click', function () {
            togglePanel(true);
            if (panelShown() && isPhone()) requestAnimationFrame(function () { $('queueTitle').scrollIntoView({ block: 'start' }); });
        });
        const lyricsGo = function () { if (guard('settings', toggleLyrics)) toggleLyrics(); };
        $('lyricsBtn').addEventListener('click', lyricsGo);
        $('npLyricsBtn').addEventListener('click', lyricsGo);
        $('lyricsClose').addEventListener('click', function go() { if (guard('settings', go)) S.set('lyrics', false); });
        $('muteBtn').addEventListener('click', function () { if (guard('sound', toggleMute)) toggleMute(); });
        /* sliders under the party lock: a press asks for the PIN, and the
           thumb stays where it was */
        const lockSlider = function (el, what) {
            el.addEventListener('pointerdown', function (e) { if (locked()) { e.preventDefault(); guard(what); } });
            el.addEventListener('keydown', function (e) {
                if (locked() && /^(Arrow|Page|Home|End)/.test(e.key)) { e.preventDefault(); e.stopPropagation(); guard(what); }
            });
        };
        lockSlider($('volumeBar'), 'sound');
        lockSlider($('seekBar'), 'seek');
        $('volumeBar').addEventListener('input', function (e) {
            if (locked()) { applySound(); return; }
            setVolume(+e.target.value);
        });
        const seekBar = $('seekBar');
        seekBar.addEventListener('input', function () {
            if (locked()) { seeking = false; tick(true); return; }
            seeking = true;
            const d = duration();
            $('timeNow').textContent = fmtTime(seekBar.value / 1000 * d);
            seekBar.style.setProperty('--pct', seekBar.value / 10 + '%');
        });
        seekBar.addEventListener('change', function () {
            if (locked()) { seeking = false; tick(true); return; }
            seeking = false;
            seek(seekBar.value / 1000 * duration());
        });

        /* panel */
        $('npHide').addEventListener('click', function () { if (!isPhone()) panelHidden = true; setPanel(false); $('pbNow').focus(); });
        $('videoPoster').addEventListener('click', function () { if (currentAlbum) userToggle(); });
        $('queueClear').addEventListener('click', function () { if (guard('queue', clearQueue)) clearQueue(); });

        /* lyrics timing — per song; the number resets it */
        const offsetBy = function (d) { return function go() { if (guard('settings', go)) setLyricsOffset(d === 0 ? 0 : lyricsOffset + d, true); }; };
        $('lyricsSooner').addEventListener('click', offsetBy(LYRICS_OFFSET_STEP));
        $('lyricsLater').addEventListener('click', offsetBy(-LYRICS_OFFSET_STEP));
        $('lyricsOffsetVal').addEventListener('click', offsetBy(0));

        /* settings + help */
        const openSettings = function () { openModal('settingsScrim'); };
        $('settingsBtn').addEventListener('click', function () { if (guard('settings', openSettings)) openSettings(); });
        $('settingsX').addEventListener('click', function () { closeModal('settingsScrim'); });
        $('settingsScrim').addEventListener('click', function (e) { if (e.target === e.currentTarget) closeModal('settingsScrim'); });
        $('settingsHelp').addEventListener('click', function () { closeModal('settingsScrim'); openModal('helpScrim'); });
        $('settingsFull').addEventListener('click', function () { closeModal('settingsScrim'); toggleFullscreen(); });
        $('setAutoplay').addEventListener('change', function (e) { S.set('autoplay', e.target.checked); });
        $('setSmooth').addEventListener('change', function (e) { S.set('smooth', e.target.checked); });
        $('setShuffle').addEventListener('change', function (e) { S.set('shuffle', e.target.checked); });
        $('setLyrics').addEventListener('change', function (e) { S.set('lyrics', e.target.checked); });
        $('setWall').addEventListener('change', function (e) { S.set('wallMotion', e.target.checked); });
        $('setSound').addEventListener('change', function (e) { S.set('muted', !e.target.checked); });
        $('setVolume').addEventListener('input', function (e) { setVolume(+e.target.value); });
        $('helpX').addEventListener('click', function () { closeModal('helpScrim'); });
        $('helpOk').addEventListener('click', function () { closeModal('helpScrim'); });
        $('helpScrim').addEventListener('click', function (e) { if (e.target === e.currentTarget) closeModal('helpScrim'); });

        MG.on('settings', function (d) {
            if (d.key === 'muted' || d.key === 'volume' || d.key === 'smooth') applySound();
            else if (d.key === 'partyLock') renderQueue();
            else if (d.key === 'lyrics') syncLyricsUI();
            else if (d.key === 'shuffle') {
                playlist = { key: '', order: [], played: new Set() };   /* a fresh pass */
                renderThen();
                if (searchOpen()) renderSearch();
            } else if (d.key === 'autoplay') {
                renderThen();
                /* on with nothing playing: start (not when the party setup sets it) */
                if (d.value && !currentAlbum && d.from !== 'preset') playNext();
            }
            if (!$('settingsScrim').hidden) syncSettings();
        });

        MG.on('lock', renderQueue);
        wireKeys();
        window.addEventListener('carino:langchange', function () { setTimeout(relabel, 0); });
        window.matchMedia('(max-width: 640px)').addEventListener('change', function () {
            relabel();
            if (isPhone()) setPanel(false); else if (currentAlbum && !panelHidden) setPanel(true);
        });

        populateGrid(grid);
        ensureScrollable(grid);
        startAutoScroll(grid);
        relabel();

        /* restore Up next, the song and the search box from the URL */
        const p = new URLSearchParams(location.search);
        (p.get('q') || '').split(',').forEach(function (vid) {
            const a = albumByUrl(vid.trim());
            if (a && !queue.some(function (q) { return q.url === a.url; }) && queue.length < QUEUE_MAX) queue.push(a);
        });
        if (queue.length) queueChanged('restore', {});
        const v = p.get('v') && albumByUrl(p.get('v').trim());
        if (v) play(v, { defer: true, from: 'url' });
        const s = p.get('s');
        if (s) {
            input.value = s;
            syncSearchClear();
            openSearch();
        }
        setPanel(!!currentAlbum && !isPhone());
        setPlaying(false, currentAlbum ? 'paused' : 'idle');

        /* ── Public API (see mg-core.js) ── */
        Object.assign(MG, {
            play: function (x, o) { play(x, Object.assign({ from: 'api' }, o || {})); },
            toggle: togglePlay, next: playNext, prev: playPrevious, seek: seek,
            enqueue: function (x, o) { return enqueue(x, Object.assign({ from: 'api' }, o || {})); },
            removeAt: removeAt, move: moveQueue, clearQueue: clearQueue,
            setFilter: applyFilter, setVolume: setVolume,
            setMuted: function (b) { S.set('muted', !!b); },
            albums: function () { return albums; }, albumByUrl: albumByUrl,
            search: function (q, n) { return searchSongs(q, n); },
            state: function () {
                return { current: currentAlbum, deferred: !!mediaDeferred, playing: isPlaying,
                         time: nowTime(), duration: duration(), queue: queue.slice(),
                         filter: Object.assign({}, filter), filterLabel: filterLabel(filter),
                         lyrics: { cues: lyricsData.slice(), index: lyricsCueIdx, notes: lyricsNotes, offset: lyricsOffset },
                         settings: S.all(), unavailable: Array.from(failed) };
            },
            toast: toast,
            openSettings: function () { openModal('settingsScrim'); },
            closeSettings: function () { closeModal('settingsScrim'); },
        });
        MG.emit('ready', { albums: albums });
    });
})();
