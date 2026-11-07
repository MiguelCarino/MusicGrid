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
 *   ambient  the cover wall drifting slowly, covers swapping in at random
 *            so a long night never shows the same wall; the line being sung
 *            over it (L hides or shows it, remembered); a now-playing tag.
 *
 * Keys: F fullscreen (or a click) · 1 2 3 the mode · L ambient lyrics ·
 * [ ] lyrics later or sooner (Shift: 1 s), \ the song's own timing ·
 * A how lyric lines move (the music page's lyricsAnim setting) ·
 * Space/K play or pause · N next · B previous (sent to the music page). The cursor hides
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
        ambLyrics: (function () { try { return localStorage.getItem('mg_display_lyrics') !== '0'; } catch (e) { return true; } })(),
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
    let lastHeard = 0, askedAt = 0, nudgedAt = 0;
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
        case 'lyricsoffset':
            st.offset = +m.offset || 0; lineKey = ''; ambKey = '';
            if (Date.now() - nudgedAt < 1500) flash('⏱ ' + (st.offset > 0 ? '+' : st.offset < 0 ? '−' : '±') + Math.abs(st.offset).toFixed(2) + 's');
            break;
        case 'settings':
            st.settings[m.key] = m.value;
            if (m.key === 'displayMode') setMode(m.value, true);
            else if (m.key === 'lyricsAnim') flash('✨ ' + tr(ANIM_NAMES[m.value] || 'Mix'));
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
            if (v === 'ambient' || v === 'ready') { buildWall(false); startReplenish(); }
            else stopReplenish();
        }
        /* the mascots dance only on the party screen */
        if (v === 'party' && st.album && window.MGDancer) {
            if (danceAlbum !== st.album) { danceAlbum = st.album; MGDancer.show(st.album, $('stage')); }
        } else if (danceAlbum) { danceAlbum = null; if (window.MGDancer) MGDancer.hide(); }
        $('noLyrics').hidden = !(st.mode === 'karaoke' && v === 'party');
        if (full) { renderSong(); renderNext(); }
        renderPlaying();
        lineKey = ''; ambKey = '';
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
            const update = function () {
                kar.classList.toggle('has-title', k.title);
                body.classList.toggle('dp-titling', k.title);
                kar.classList.toggle('in-gap', k.gap);
                kar.classList.toggle('no-cur', k.cur < 0);
                const c = st.cues;
                const prevText = k.prev >= 0 && k.cur >= 0 ? c[k.prev].original : (k.gap && k.prev >= 0 ? c[k.prev].original : '');
                const curText = k.cur >= 0 ? c[k.cur].original : '';
                const nextText = k.next >= 0 ? c[k.next].original : '';
                $('linePrev').textContent = prevText; $('linePrev').dataset.t = prevText;
                fillWords($('lineCurText'), curText); $('lineCur').dataset.t = curText;
                $('lineCurTrans').textContent = k.cur >= 0 ? (c[k.cur].translation || '') : '';
                $('lineNext').textContent = nextText; $('lineNext').dataset.t = nextText;
            };
            if (fresh && !reduced()) moveLines({ prev: $('linePrev'), cur: $('lineCur'), next: $('lineNext') }, update, animStyle());
            else update();
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
        else if (shownView === 'ambient') renderAmbient();
        else if (ambKey !== 'off') { ambKey = 'off'; body.classList.remove('dp-amb-on'); }
    }

    /* ── Ambient lyrics: the line being sung over the wall ──── */
    let ambKey = '';
    function renderAmbient() {
        if (!st.ambLyrics || !st.cues.length) {
            if (ambKey !== 'off') { ambKey = 'off'; body.classList.remove('dp-amb-on'); }
            return;
        }
        const k = karaokeAt(songTime() + st.offset);
        const key = k.cur + '|' + k.next;
        if (key === ambKey) return;
        ambKey = key;
        const c = st.cues, on = k.cur >= 0;
        const wasOn = body.classList.contains('dp-amb-on');
        body.classList.toggle('dp-amb-on', on);
        if (!on) return;   /* intro, break, outro: the wall alone (the last line fades with it) */
        const update = function () {
            const cur = c[k.cur].original || '', trans = c[k.cur].translation || '';
            const next = k.next >= 0 ? (c[k.next].original || '') : '';
            $('ambCur').textContent = cur; $('ambCur').dataset.t = cur;
            $('ambCur').classList.toggle('long', cur.length > 42);   /* a size down: it keeps to the band's rows */
            $('ambTrans').textContent = trans; $('ambTrans').dataset.t = trans;
            $('ambNext').textContent = next; $('ambNext').dataset.t = next;
        };
        if (wasOn && !reduced()) moveLines({ cur: $('ambCur'), trans: $('ambTrans'), next: $('ambNext') }, update, animStyle());
        else update();
    }

    /* ── Lines that travel (karaoke, ambient) ──────────────── */
    /* moveLines(slots, update, style): slots are the line elements by role
       (prev · cur · next, and trans on the ambient band), each with its
       text in data-t. Before update() the lines on screen are measured and
       copied; after it:
         rise  a line that moved slot glides there from where it was (the
               next line climbs into the sung place, the sung line up to
               the last one); the line that goes floats up and away; a new
               line comes up from below
         fade  the old lines dissolve, the new ones come into focus
         zoom  the old lines fly at you and fade, the new ones pop up
         roll  the lines turn over on a drum
       Mix (the setting's default) picks one per song, the same one the music
       page picks. */
    const ANIMS = ['rise', 'fade', 'zoom', 'roll'];
    const ANIM_NAMES = { mix: 'Mix', rise: 'Rise', fade: 'Fade', zoom: 'Zoom', roll: 'Roll' };
    const FROM = { prev: 'cur', cur: 'next' };   /* where a line comes from when the song moves on */
    function animStyle() {
        const s = st.settings.lyricsAnim || 'mix';
        if (s !== 'mix') return ANIMS.indexOf(s) >= 0 ? s : 'rise';
        const u = (st.album && st.album.url) || '';
        let h = 0;
        for (let i = 0; i < u.length; i++) h = (h * 31 + u.charCodeAt(i)) | 0;
        return ANIMS[Math.abs(h) % 4];
    }
    function onScreen(el) { return !!(el && el.dataset.t && el.getClientRects().length); }
    function fontOf(el) {
        const f = el.querySelector('.dp-sung') || el;
        return parseFloat(getComputedStyle(f).fontSize) || 16;
    }
    /* a copy of a line, left exactly where it is, to animate away */
    function ghostOf(el, rect) {
        const g = el.cloneNode(true);
        g.removeAttribute('id');
        g.querySelectorAll('[id]').forEach(function (n) { n.removeAttribute('id'); });
        g.setAttribute('aria-hidden', 'true');
        Object.assign(g.style, { position: 'fixed', left: '0px', top: '0px', margin: '0', width: rect.width + 'px',
                                 boxSizing: 'border-box', pointerEvents: 'none', zIndex: '3' });
        el.parentNode.appendChild(g);
        /* fixed inside a transformed box (the ambient band) is relative to
           that box: measure, then put it back over the original */
        const at = g.getBoundingClientRect();
        g.style.left = (rect.left - at.left) + 'px';
        g.style.top = (rect.top - at.top) + 'px';
        return g;
    }
    function moveLines(slots, update, style) {
        const unit = Math.min(innerWidth, innerHeight) / 100;   /* 1vmin */
        const old = {};
        Object.keys(slots).forEach(function (k) {
            const el = slots[k];
            if (!onScreen(el)) return;
            const rect = el.getBoundingClientRect();   /* mid-flight too: no jumps */
            old[k] = { t: el.dataset.t, rect: rect, font: fontOf(el), ghost: ghostOf(el, rect) };
            el.getAnimations().forEach(function (a) { a.cancel(); });
        });
        update();
        const used = {};
        const ease = 'cubic-bezier(0.22, 0.8, 0.24, 1)';
        Object.keys(slots).forEach(function (k, i) {
            const el = slots[k];
            if (!onScreen(el)) return;
            const src = old[FROM[k]];
            if (style === 'rise' && src && src.t === el.dataset.t) {
                /* FLIP: from the old place and size to the new */
                used[FROM[k]] = true;
                const r = el.getBoundingClientRect();
                const dx = (src.rect.left + src.rect.width / 2) - (r.left + r.width / 2);
                const dy = (src.rect.top + src.rect.height / 2) - (r.top + r.height / 2);
                const s = src.font / fontOf(el);
                el.animate([{ transform: 'translate(' + dx + 'px, ' + dy + 'px) scale(' + s + ')', opacity: 0.75 },
                            { transform: 'none', opacity: 1 }], { duration: 620, easing: ease });
                return;
            }
            const delay = style === 'rise' ? (k === 'next' ? 140 : 60) : (k === 'cur' ? 170 : k === 'next' ? 280 : 220);
            const IN = {
                rise: [{ transform: 'translateY(' + 5 * unit + 'px)', opacity: 0 }, { transform: 'none', opacity: 1 }],
                fade: [{ filter: 'blur(' + 1.2 * unit + 'px)', opacity: 0 }, { filter: 'blur(0)', opacity: 1 }],
                zoom: [{ transform: 'scale(0.55)', opacity: 0 }, { transform: 'none', opacity: 1 }],
                roll: [{ transform: 'perspective(' + 90 * unit + 'px) translateY(' + 5 * unit + 'px) rotateX(-75deg)', opacity: 0 },
                       { transform: 'none', opacity: 1 }],
            };
            el.animate(IN[style], { duration: style === 'fade' ? 700 : 560, delay: delay, fill: 'backwards',
                                    easing: style === 'zoom' ? 'cubic-bezier(0.34, 1.5, 0.64, 1)' : ease });
        });
        Object.keys(old).forEach(function (k) {
            const g = old[k].ghost;
            if (used[k]) { g.remove(); return; }   /* it lives on, in its new slot */
            const OUT = {
                rise: [{ transform: 'none', opacity: 1 }, { transform: 'translateY(' + -7 * unit + 'px) scale(0.92)', opacity: 0 }],
                fade: [{ filter: 'blur(0)', opacity: 1 }, { filter: 'blur(' + 1.4 * unit + 'px)', opacity: 0 }],
                zoom: [{ transform: 'none', opacity: 1, filter: 'blur(0)' }, { transform: 'scale(1.4)', opacity: 0, filter: 'blur(' + 0.8 * unit + 'px)' }],
                roll: [{ transform: 'none', opacity: 1 },
                       { transform: 'perspective(' + 90 * unit + 'px) translateY(' + -5 * unit + 'px) rotateX(75deg)', opacity: 0 }],
            };
            g.animate(OUT[style], { duration: style === 'fade' ? 480 : 400, easing: 'cubic-bezier(0.3, 0.6, 0.4, 1)', fill: 'forwards' })
                .finished.then(function () { g.remove(); }, function () { g.remove(); });
        });
    }
    function toggleAmbLyrics() {
        st.ambLyrics = !st.ambLyrics;
        try { localStorage.setItem('mg_display_lyrics', st.ambLyrics ? '1' : '0'); } catch (e) {}
        ambKey = '';
        flash('🎤 ' + tr(st.ambLyrics ? 'Lyrics shown' : 'Lyrics hidden'));
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
        /* about five covers across the short side, so a bigger or wider
           monitor gets more of them, never smaller than 110 px */
        const cell = Math.max(110, Math.min(w, h) / (h > w ? 4 : 5));
        const cols = Math.max(3, Math.round(w / cell));
        const colW = w / cols, per = Math.ceil(h / colW) + 2;
        const pool = list.slice();
        for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const x = pool[i]; pool[i] = pool[j]; pool[j] = x; }
        let k = 0;
        wallCells = []; wallPer = per; wallOn = new Map();
        const frag = document.createDocumentFragment();
        for (let c = 0; c < cols; c++) {
            const col = document.createElement('div');
            col.className = 'dp-col' + (c % 2 ? ' down' : '');
            col.style.setProperty('--dur', (110 + ((c * 37) % 70)) + 's');
            col.style.setProperty('--delay', -((c * 23) % 60) + 's');
            const strip = document.createElement('div');
            strip.className = 'dp-strip';
            const covers = [], cells = [];
            for (let r = 0; r < per; r++) covers.push(pool[k++ % pool.length]);
            covers.concat(covers).forEach(function (a, i) {
                const d = document.createElement('div');
                d.className = 'dp-cell';
                d.style.backgroundImage = 'url("' + cover(a) + '")';
                d._img = a.image;
                if (i < per) wallOn.set(a.image, (wallOn.get(a.image) || 0) + 1);
                strip.appendChild(d);
                cells.push(d);
            });
            wallCells.push(cells);
            col.appendChild(strip);
            frag.appendChild(col);
        }
        wall.innerHTML = '';
        wall.appendChild(frag);
    }

    /* Replenish: every few seconds a few covers on screen fade into ones
       not on the wall yet. The strip holds its covers twice (the loop), so
       both copies change together and the loop stays seamless. */
    let wallCells = [], wallPer = 0, wallOn = new Map(), replTimer = null;
    const REPL_MS = 2600;
    function startReplenish() {
        if (replTimer) return;
        replTimer = setInterval(replenish, REPL_MS);
    }
    function stopReplenish() { clearInterval(replTimer); replTimer = null; }
    function freshCover() {
        const list = (typeof albums !== 'undefined' && albums.length) ? albums : [];
        if (!list.length) return null;
        for (let i = 0; i < 12; i++) {
            const a = list[Math.floor(Math.random() * list.length)];
            if (!wallOn.has(a.image)) return a;
        }
        return list[Math.floor(Math.random() * list.length)];   /* a small catalogue: any will do */
    }
    function visible(el) {
        const r = el.getBoundingClientRect();
        return r.bottom > 0 && r.top < innerHeight;
    }
    function replenish() {
        if (document.hidden || !wallCells.length) return;
        /* about one cover in twenty-five on screen changes each time: a
           TV gets one or two, a big or ultrawide monitor more */
        const shown = wallCells.length * Math.ceil(innerHeight / (innerWidth / wallCells.length));
        let n = Math.max(1, Math.round(shown / 25));
        for (let tries = 0; n > 0 && tries < n * 6; tries++) {
            const cells = wallCells[Math.floor(Math.random() * wallCells.length)];
            const r = Math.floor(Math.random() * wallPer);
            const a = cells[r], b = cells[r + wallPer];
            if (!a || !b || a._busy || (!visible(a) && !visible(b))) continue;
            const next = freshCover();
            if (!next || next.image === a._img) continue;
            const left = (wallOn.get(a._img) || 1) - 1;
            if (left > 0) wallOn.set(a._img, left); else wallOn.delete(a._img);
            wallOn.set(next.image, (wallOn.get(next.image) || 0) + 1);
            [a, b].forEach(function (d) { swapCell(d, next); });
            n--;
        }
    }
    function swapCell(d, a) {
        const url = 'url("' + cover(a) + '")';
        d._img = a.image;
        if (reduced()) { d.style.backgroundImage = url; return; }
        d._busy = true;
        const img = new Image();
        img.onload = img.onerror = function () {
            const o = document.createElement('div');
            o.className = 'dp-cell-in';
            o.style.backgroundImage = url;
            o.addEventListener('animationend', function () {
                d.style.backgroundImage = url;
                o.remove();
                d._busy = false;
            }, { once: true });
            d.appendChild(o);
        };
        img.src = cover(a);
    }
    document.addEventListener('visibilitychange', function () {
        if (document.hidden) stopReplenish();
        else if (shownView === 'ambient' || shownView === 'ready') startReplenish();
    });

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
        else if (k === 'l' || k === 'L') toggleAmbLyrics();
        else if (k === 'a' || k === 'A') post('cmd', { action: 'lyricsanim' });
        else if (k === '[' || k === ']' || k === '{' || k === '}' || k === '\\' || k === '|') {
            nudgedAt = Date.now();
            const d = (k === '\\' || k === '|') ? 0 : ((k === ']' || k === '}') ? 1 : -1) * (e.shiftKey ? 1 : 0.25);
            post('cmd', { action: 'offset', delta: d });
        }
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
