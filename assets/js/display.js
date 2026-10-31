/* MusicGrid — the TV display (display.html).
 *
 * A second window for the TV or projector. It plays nothing: the music
 * page (index.html) keeps the sound and sends everything here over
 * BroadcastChannel('musicgrid') (the message list is in display-link.js).
 * On load this page says 'hello' and gets a snapshot; when the music page
 * goes quiet it asks again, and if nobody answers it shows "Waiting for
 * the music…".
 *
 * Three modes (the music page's Settings → TV display, or 1 2 3 here):
 *   karaoke  the line being sung, huge, the next one under it, the last one
 *            faded; a 3-2-1 before the first line and after long breaks; the
 *            title big before the singing starts. A song with no lyrics
 *            falls back to party, with a note.
 *   party    the mascots dancing big (dancer.js), the cover blurred behind,
 *            the song, a progress bar and the next three songs.
 *   ambient  the cover wall drifting slowly, a small now-playing tag.
 *
 * Keys: F fullscreen (or a click) · 1 2 3 the mode · Space/K play or
 * pause · N next · B previous (sent to the music page). The cursor hides
 * after 3 s still; the screen is kept awake while it shows.
 */
(function () {
    'use strict';

    const MODES = ['karaoke', 'party', 'ambient'];
    const MODE_ICON = { karaoke: '🎤', party: '🕺', ambient: '🖼' };
    const QUIET_MS = 3500, ANSWER_MS = 2500;   /* re-sync after 3.5 s of silence; give up 2.5 s later */
    const $ = function (id) { return document.getElementById(id); };
    const root = document.documentElement, body = document.body;
    const tr = function (k) { return typeof window.t === 'function' ? window.t(k) : k; };
    const reduced = function () { return window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches; };
    const cover = function (a) { return 'assets/covers/' + a.image; };
    function splitTag(album) {
        const tag = (album && album.tag) || '';
        const i = tag.indexOf(' — ');
        return i >= 0 ? { artist: tag.slice(0, i), title: tag.slice(i + 3) } : { artist: '', title: tag };
    }
    function fmt(s) {
        s = Math.max(0, Math.floor(s || 0));
        return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
    }

    /* ── What the music page told us ───────────────────────── */
    const st = {
        connected: false,
        mode: root.getAttribute('data-mode') || 'party',
        album: null, deferred: false, playing: false,
        base: { time: 0, at: 0 }, duration: 0,
        queue: [], filterLabel: '', settings: {},
        cues: [], notes: false, offset: 0,
    };
    function songTime() {
        let t = st.base.time;
        if (st.playing && !st.deferred) t += (performance.now() - st.base.at) / 1000;
        return st.duration ? Math.min(t, st.duration) : t;
    }
    /* a new reading of the clock: small drifts are eased in, so the
       lyrics never jump back and forth */
    function setTime(time, duration) {
        if (duration) st.duration = duration;
        const now = performance.now(), guess = songTime();
        const diff = time - guess;
        if (st.playing && st.base.at && Math.abs(diff) < 0.4) st.base = { time: guess + diff * 0.5, at: now };
        else st.base = { time: time || 0, at: now };
    }

    /* ── The channel ───────────────────────────────────────── */
    let bc = null;
    try { bc = new BroadcastChannel('musicgrid'); } catch (e) { bc = null; }
    let lastHeard = 0, askedAt = 0;
    function post(type, data) {
        if (!bc) return;
        try { bc.postMessage(Object.assign({ type: type, src: 'display' }, data || {})); } catch (e) {}
    }
    function hello() { askedAt = Date.now(); post('hello'); }

    function onMessage(m) {
        if (!m || m.src !== 'control') return;
        lastHeard = Date.now();
        switch (m.type) {
        case 'snapshot': applySnapshot(m); break;
        case 'bye': setConnected(false); return;
        case 'ping': post('beat'); break;
        case 'beat':
            if (!st.connected) { hello(); return; }   /* it is back: catch up */
            if (!st.playing) setTime(m.time, m.duration);
            break;
        case 'track':
            setAlbum(m.album, m.deferred);
            st.cues = []; st.notes = false;   /* its lyrics come next */
            st.base = { time: 0, at: performance.now() }; st.duration = 0;
            render(true);
            break;
        case 'playstate': {
            const t = songTime();   /* the clock stops (or starts) where it is */
            st.playing = !!m.playing;
            if (st.playing) st.deferred = false;
            st.base = { time: t, at: performance.now() };
            renderPlaying();
            break;
        }
        case 'time': setTime(m.time, m.duration); break;
        case 'queue': st.queue = m.queue || []; renderNext(); break;
        case 'filter': st.filterLabel = m.label || st.filterLabel; renderNext(); break;
        case 'lyrics': st.cues = m.cues || []; st.notes = !!m.notes; lineKey = ''; render(); break;
        case 'lyricsoffset': st.offset = +m.offset || 0; break;
        case 'settings':
            st.settings[m.key] = m.value;
            if (m.key === 'displayMode') setMode(m.value, true);
            else if (m.key === 'autoplay' || m.key === 'shuffle') renderNext();
            break;
        case 'theme': setTheme(m.theme); break;
        case 'lang': setLang(m.lang); break;
        }
        if (!st.connected && m.type !== 'snapshot') hello();
    }
    if (bc) bc.onmessage = function (e) { onMessage(e.data); };

    function applySnapshot(m) {
        const s = m.state;
        if (m.theme) setTheme(m.theme);
        if (m.lang) setLang(m.lang);
        if (m.mode) setMode(m.mode, true);
        if (s) {
            setAlbum(s.current, s.deferred);
            st.playing = !!s.playing;
            st.base = { time: s.time || 0, at: performance.now() };
            st.duration = s.duration || 0;
            st.queue = s.queue || [];
            st.filterLabel = s.filterLabel || '';
            st.settings = s.settings || {};
            st.cues = (s.lyrics && s.lyrics.cues) || [];
            st.notes = !!(s.lyrics && s.lyrics.notes);
            st.offset = (s.lyrics && +s.lyrics.offset) || 0;
        }
        lineKey = '';
        setConnected(true);
        render(true);
    }

    function setConnected(on) {
        if (st.connected === on) return;
        st.connected = on;
        if (!on) { st.playing = false; askedAt = 0; }
        render(true);
    }

    /* every second: still there? A display the music page has not heard
       from in a while asks again, and gives up if nobody answers. */
    setInterval(function () {
        const now = Date.now();
        if (now - lastHeard > QUIET_MS) {
            if (!askedAt || now - askedAt > ANSWER_MS * 2) hello();
            else if (st.connected && now - askedAt > ANSWER_MS) setConnected(false);
        }
    }, 1000);
    setInterval(function () { post('beat'); }, 2000);
    window.addEventListener('pagehide', function () { post('bye'); });

    /* ── Look and language follow the music page ───────────── */
    function setTheme(t) {
        if (t !== 'gold' && t !== 'color') return;
        root.setAttribute('data-carino-theme', t);
    }
    window.addEventListener('storage', function (e) {
        if (e.key === 'carino-theme') setTheme(e.newValue);
    });
    function setLang(l) {
        if (!l || typeof setLocale !== 'function' || root.lang === l) return;
        setLocale(l);
        if (typeof applyStaticI18n === 'function') applyStaticI18n();
        render(true);
    }

    /* ── Modes ─────────────────────────────────────────────── */
    function setMode(mode, fromControl) {
        if (MODES.indexOf(mode) < 0) return;
        const changed = mode !== st.mode;
        st.mode = mode;
        root.setAttribute('data-mode', mode);
        if (!fromControl) {
            if (st.connected) post('mode', { mode: mode });
            else { try { localStorage.setItem('mg_display_mode', mode); } catch (e) {} }
        }
        if (changed) { flash(MODE_ICON[mode] + ' ' + tr(modeName(mode))); render(true); }
    }
    function modeName(m) { return m === 'karaoke' ? 'Karaoke' : m === 'ambient' ? 'Ambient' : 'Party'; }

    /* Which screen shows: waiting (no music page) · ready (nothing loaded)
       · karaoke · party · ambient. Karaoke without lyrics dances instead. */
    function view() {
        if (!st.connected) return 'waiting';
        if (!st.album) return 'ready';
        if (st.mode === 'karaoke') return st.notes && !st.cues.length ? 'party' : 'karaoke';
        return st.mode;
    }

    let flashTimer = null;
    function flash(text) {
        const el = $('flash');
        el.textContent = text;
        el.classList.add('show');
        clearTimeout(flashTimer);
        flashTimer = setTimeout(function () { el.classList.remove('show'); }, 1400);
    }

    /* ── The song ──────────────────────────────────────────── */
    let bgFlip = 0, bgUrl = '';
    function setAlbum(album, deferred) {
        const same = st.album && album && st.album.url === album.url;
        st.album = album || null;
        st.deferred = !!deferred;
        if (same) return;
        const url = album ? cover(album) : '';
        if (url !== bgUrl) {
            bgUrl = url;
            const layers = document.querySelectorAll('.dp-bg-img');
            bgFlip = 1 - bgFlip;
            layers[bgFlip].style.backgroundImage = url ? 'url("' + url + '")' : 'none';
            layers[bgFlip].classList.add('on');
            layers[1 - bgFlip].classList.remove('on');
        }
        renderSong();
    }
    function renderSong() {
        const a = st.album;
        const s = splitTag(a);
        const src = a ? cover(a) : '';
        ['partyCover', 'tcCover', 'tagCover'].forEach(function (id) {
            const img = $(id);
            if (src) img.src = src; else img.removeAttribute('src');
        });
        $('partyTitle').textContent = $('tcTitle').textContent = $('tagTitle').textContent = s.title;
        $('partyArtist').textContent = $('tcArtist').textContent = $('tagArtist').textContent = s.artist;
        fitTitle($('partyTitle'), s.title);
        fitTitle($('tcTitle'), s.title);
        const meta = $('partyMeta');
        meta.innerHTML = '';
        if (a) {
            const bits = [];
            const c = typeof COUNTRIES === 'object' && COUNTRIES[a.country];
            const g = typeof GENRES === 'object' && GENRES[a.genre];
            const md = typeof MOODS === 'object' && MOODS[a.mood];
            if (c) bits.push((c.flag ? c.flag + ' ' : '') + c.name);
            if (g) bits.push((g.icon ? g.icon + ' ' : '') + g.name);
            if (md) bits.push((md.icon ? md.icon + ' ' : '') + md.name);
            bits.forEach(function (b) {
                const span = document.createElement('span');
                span.textContent = b;
                meta.appendChild(span);
            });
        }
    }
    /* long titles step down a size or two instead of wrapping onto 4 lines */
    function fitTitle(el, text) {
        const n = (text || '').length;
        el.classList.toggle('long', n > 22 && n <= 40);
        el.classList.toggle('longer', n > 40);
    }

    function renderNext() {
        const list = $('partyNext');
        list.innerHTML = '';
        const next = st.queue.slice(0, 3);
        next.forEach(function (a, i) {
            const li = document.createElement('li');
            const img = document.createElement('img');
            img.src = cover(a); img.alt = '';
            const s = splitTag(a);
            const txt = document.createElement('div');
            const b = document.createElement('b'); b.textContent = s.title;
            const sp = document.createElement('span'); sp.textContent = s.artist;
            txt.append(b, sp);
            const n = document.createElement('i'); n.textContent = String(i + 1);
            li.append(n, img, txt);
            list.appendChild(li);
        });
        const more = st.queue.length - next.length;
        const after = document.createElement('li');
        after.className = 'dp-next-after';
        if (more > 0) after.textContent = '+ ' + more + ' ' + tr('more');
        else if (st.settings.autoplay) after.textContent = (next.length ? tr('Then') : tr('Next')) + ': ' + tr('Autoplay') + (st.filterLabel ? ' · ' + st.filterLabel : '');
        else after.textContent = next.length ? tr('Music stops after Up next.') : tr('Music stops after this song.');
        list.appendChild(after);
        /* the corner line */
        const first = st.queue[0];
        $('upNextText').textContent = first ? splitTag(first).title + (splitTag(first).artist ? ' · ' + splitTag(first).artist : '')
            : st.settings.autoplay ? tr('Autoplay') + (st.filterLabel ? ' · ' + st.filterLabel : '') : '—';
        body.classList.toggle('dp-no-next', !first && !st.settings.autoplay);
    }

    function renderPlaying() {
        const playing = st.playing && !st.deferred;
        $('stage').classList.toggle('playing', playing);
        body.classList.toggle('dp-playing', playing);
        $('paused').hidden = !st.connected || !st.album || playing;
    }

    /* ── The views ─────────────────────────────────────────── */
    let shownView = '', danceAlbum = null;
    function render(full) {
        const v = view();
        if (v !== shownView) {
            shownView = v;
            body.setAttribute('data-view', v);
            if (v === 'ambient' || v === 'ready') buildWall(false);
        }
        /* the mascots dance only on the party screen */
        if (v === 'party' && st.album && window.MGDancer) {
            if (danceAlbum !== st.album) { danceAlbum = st.album; MGDancer.show(st.album, $('stage')); }
        } else if (danceAlbum) { danceAlbum = null; if (window.MGDancer) MGDancer.hide(); }
        $('noLyrics').hidden = !(st.mode === 'karaoke' && v === 'party');
        if (full) { renderSong(); renderNext(); }
        renderPlaying();
        lineKey = '';
        frame();
    }

    /* ── Karaoke ───────────────────────────────────────────── */
    /* an intro, break or outro line (♪, (Instrumental), empty) */
    const GAP_LINE = /^[\s♪♫…・.\-–—]*$|^[(（[]\s*(instrumental|interlude|intro|outro|solo|music|break|間奏)[^)）\]]*[)）\]]$/i;
    const COUNT = 3, LONG_BREAK = 8, STALE = 8;
    function isGap(cue) { return !cue || GAP_LINE.test(cue.original || ''); }
    function sungAt(i) { while (i >= 0 && isGap(st.cues[i])) i--; return i; }
    function nextSung(i) { i++; while (i < st.cues.length && isGap(st.cues[i])) i++; return i < st.cues.length ? i : -1; }

    /* Everything the karaoke screen shows at lyrics time t */
    function karaokeAt(t) {
        const cues = st.cues;
        let idx = -1;
        for (let i = 0; i < cues.length; i++) { if (cues[i].time <= t) idx = i; else break; }
        const nx = nextSung(idx), next = nx >= 0 ? cues[nx] : null;
        const out = { title: false, cur: -1, prev: -1, next: nx, count: 0, gap: false, sweep: 0 };
        if (!cues.length) { out.title = true; return out; }
        if (idx < 0 || sungAt(idx) < 0) {                 /* before the singing starts */
            out.title = true;
            if (next && next.time - t <= COUNT) out.count = Math.ceil(next.time - t);
            return out;
        }
        const ci = sungAt(idx), cur = cues[ci];
        const lastStart = cur.time, gapLen = next ? next.time - lastStart : Infinity;
        const brk = isGap(cues[idx]) && (next ? next.time - cues[idx].time >= 4 : true);   /* a ♪ line long enough */
        const stale = t - lastStart > STALE && (!next || next.time - t > COUNT);           /* a line held too long */
        if (brk || stale) {
            out.gap = true; out.prev = ci; out.next = nx;
            if (next && gapLen >= LONG_BREAK && next.time - t <= COUNT) out.count = Math.ceil(next.time - t);
            return out;
        }
        out.cur = ci; out.prev = sungAt(ci - 1); out.next = nx;
        /* how far through the line: about 14 characters a second, never
           past the next line */
        const len = (cur.original || '').length;
        const dur = Math.max(0.8, Math.min(len / 14 + 0.4, (next ? next.time - lastStart : 6) * 0.92));
        out.sweep = Math.max(0, Math.min(1, (t - lastStart) / dur));
        return out;
    }

    /* The line being sung, a word per span: the words turn gold as the
       line goes by (word by word, so a line that wraps fills in reading
       order) */
    let words = [], wordEnds = [], sungWords = -1;
    function fillWords(el, text) {
        el.textContent = '';
        words = []; wordEnds = []; sungWords = -1;
        const parts = (text || '').split(/(\s+)/);
        let n = 0;
        const total = (text || '').replace(/\s+/g, '').length || 1;
        parts.forEach(function (p) {
            if (!p) return;
            if (/^\s+$/.test(p)) { el.appendChild(document.createTextNode(p)); return; }
            const w = document.createElement('span');
            w.className = 'dp-w';
            w.textContent = p;
            el.appendChild(w);
            n += p.length;
            words.push(w);
            wordEnds.push(n / total);
        });
    }
    function sweepWords(f) {
        let k = 0;
        while (k < wordEnds.length && wordEnds[k] <= f + 0.02) k++;
        if (k === sungWords) return;
        sungWords = k;
        words.forEach(function (w, i) { w.classList.toggle('on', i < k); });
    }

    let lineKey = '';
    function renderKaraoke() {
        const k = karaokeAt(songTime() + st.offset);
        const key = [k.title, k.cur, k.prev, k.next, k.gap].join('|');
        const kar = $('karaoke');
        if (key !== lineKey) {
            const fresh = lineKey !== '';
            lineKey = key;
            kar.classList.toggle('has-title', k.title);
            body.classList.toggle('dp-titling', k.title);
            kar.classList.toggle('in-gap', k.gap);
            kar.classList.toggle('no-cur', k.cur < 0);
            const c = st.cues;
            $('linePrev').textContent = k.prev >= 0 && k.cur >= 0 ? c[k.prev].original : (k.gap && k.prev >= 0 ? c[k.prev].original : '');
            fillWords($('lineCurText'), k.cur >= 0 ? c[k.cur].original : '');
            $('lineCurTrans').textContent = k.cur >= 0 ? (c[k.cur].translation || '') : '';
            $('lineNext').textContent = k.next >= 0 ? c[k.next].original : '';
            const lines = $('lines');
            if (fresh && !reduced()) { lines.classList.remove('step'); void lines.offsetWidth; lines.classList.add('step'); }
        }
        sweepWords(k.sweep);
        const count = $('count');
        count.classList.toggle('on', k.count > 0);
        count.dataset.n = k.count;
    }

    /* ── Progress (every frame) ────────────────────────────── */
    let lastSec = -1;
    function frame() {
        const t = songTime(), d = st.duration;
        const pct = d ? Math.min(100, t / d * 100) : 0;
        ['partyBar', 'tagBar', 'edgeBar'].forEach(function (id) { $(id).style.width = pct + '%'; });
        const sec = Math.floor(t);
        if (sec !== lastSec) {
            lastSec = sec;
            $('partyNow').textContent = fmt(t);
            $('partyTotal').textContent = fmt(d);
        }
        if (shownView === 'karaoke') renderKaraoke();
    }
    (function loop() {
        frame();
        requestAnimationFrame(loop);
    })();

    /* ── The cover wall (ambient, ready) ───────────────────── */
    /* Columns of covers drifting up and down at their own slow speeds:
       CSS transforms only, the covers twice over so the loop is seamless. */
    let wallSize = '';
    function buildWall(force) {
        const wall = $('wall');
        const w = innerWidth, h = innerHeight;
        const size = Math.round(w / 40) + 'x' + Math.round(h / 40);
        if (!force && size === wallSize && wall.childElementCount) return;
        wallSize = size;
        const list = (typeof albums !== 'undefined' && albums.length) ? albums : [];
        if (!list.length) return;
        const cell = Math.max(150, Math.min(w, h) / (h > w ? 3.2 : 3.6));
        const cols = Math.max(3, Math.round(w / cell));
        const colW = w / cols, per = Math.ceil(h / colW) + 2;
        const pool = list.slice();
        for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const x = pool[i]; pool[i] = pool[j]; pool[j] = x; }
        let k = 0;
        const frag = document.createDocumentFragment();
        for (let c = 0; c < cols; c++) {
            const col = document.createElement('div');
            col.className = 'dp-col' + (c % 2 ? ' down' : '');
            col.style.setProperty('--dur', (110 + ((c * 37) % 70)) + 's');
            col.style.setProperty('--delay', -((c * 23) % 60) + 's');
            const strip = document.createElement('div');
            strip.className = 'dp-strip';
            const covers = [];
            for (let r = 0; r < per; r++) covers.push(pool[k++ % pool.length]);
            covers.concat(covers).forEach(function (a) {
                const d = document.createElement('div');
                d.className = 'dp-cell';
                d.style.backgroundImage = 'url("' + cover(a) + '")';
                strip.appendChild(d);
            });
            col.appendChild(strip);
            frag.appendChild(col);
        }
        wall.innerHTML = '';
        wall.appendChild(frag);
    }
    let resizeTimer = null;
    window.addEventListener('resize', function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function () { if (shownView === 'ambient' || shownView === 'ready') buildWall(false); else wallSize = ''; }, 300);
    });

    /* ── Kiosk: fullscreen, the cursor, the screen awake ───── */
    function toggleFullscreen() {
        if (document.fullscreenElement) { if (document.exitFullscreen) document.exitFullscreen().catch(function () {}); return; }
        if (root.requestFullscreen) root.requestFullscreen().catch(function () {});
    }
    let idleTimer = null;
    function wake() {
        body.classList.remove('dp-idle');
        clearTimeout(idleTimer);
        idleTimer = setTimeout(function () { body.classList.add('dp-idle'); }, 3000);
    }
    ['pointermove', 'pointerdown', 'keydown'].forEach(function (t) { window.addEventListener(t, wake, { passive: true }); });
    window.addEventListener('click', function () { if (!document.fullscreenElement) toggleFullscreen(); });
    document.addEventListener('keydown', function (e) {
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        const k = e.key;
        if (k === 'f' || k === 'F') toggleFullscreen();
        else if (k === '1' || k === '2' || k === '3') setMode(MODES[+k - 1]);
        else if (k === ' ' || k === 'k' || k === 'K') { e.preventDefault(); post('cmd', { action: 'toggle' }); }
        else if (k === 'n' || k === 'N') post('cmd', { action: 'next' });
        else if (k === 'b' || k === 'B') post('cmd', { action: 'prev' });
    });

    let lock = null;
    function keepAwake() {
        if (!('wakeLock' in navigator) || document.visibilityState !== 'visible' || lock) return;
        navigator.wakeLock.request('screen').then(function (l) {
            lock = l;
            l.addEventListener('release', function () { lock = null; });
        }).catch(function () {});
    }
    document.addEventListener('visibilitychange', keepAwake);

    window.addEventListener('carino:langchange', function () { setTimeout(function () { render(true); }, 0); });
    document.addEventListener('DOMContentLoaded', function () {
        render(true);
        wake();
        keepAwake();
        hello();
        if (!bc) $('waiting').querySelector('.dp-wait-sub').textContent = tr('This browser cannot link a display window.');
    });
})();
