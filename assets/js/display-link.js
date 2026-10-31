/* MusicGrid — the link to the TV display (display.html).
 *
 * The music page stays the control: it plays the sound (the YouTube
 * player lives here). display.html is a second window, dragged to the TV
 * or projector, that only shows: big lyrics, the dancing mascots or the
 * cover wall. The two talk over BroadcastChannel('musicgrid'), so they
 * must be open in the same browser on the same machine.
 *
 * Messages are plain objects { type, src: 'control' | 'display', ... }.
 *   control → display
 *     snapshot  { state, mode, theme, lang }   everything, on 'hello' and
 *                                              when this page starts
 *     track · playstate · time · queue · lyrics · lyricline · lyricsoffset ·
 *     settings · filter · ended                the bus events, detail as is
 *                                              (mg-core.js lists the fields;
 *                                              the mode is settings.displayMode)
 *     theme { theme } · lang { lang }          the look follows this page
 *     beat  { playing, time, duration }        once a second: still here
 *     ping                                     anyone there? (answered by a beat)
 *     bye                                      this page is closing
 *   display → control
 *     hello                                    send me a snapshot
 *     beat                                     every 2 s: a display is open
 *     mode { mode }                            1 2 3 pressed on the display
 *     cmd  { action: 'toggle'|'next'|'prev' }  Space / N / B on the display
 *     bye                                      the display is closing
 *
 * MusicGrid.display: open() · connected() · setMode(mode) · cycleMode().
 * The mode is the 'displayMode' setting (mg-core.js), so it is remembered.
 */
(function () {
    'use strict';

    const MG = window.MusicGrid;
    if (!MG) return;
    const MODES = ['karaoke', 'party', 'ambient'];
    const NAME = 'musicgrid-display';
    const FEATURES = 'popup,width=1280,height=720';
    const ALIVE_MS = 6000;
    const tr = function (k) { return typeof window.t === 'function' ? window.t(k) : k; };

    let bc = null;
    try { bc = new BroadcastChannel('musicgrid'); } catch (e) { bc = null; }

    let win = null, lastSeen = 0, wasConnected = false, last = { time: 0, duration: 0 };

    function post(type, data) {
        if (!bc) return;
        try { bc.postMessage(Object.assign({ type: type, src: 'control' }, data || {})); } catch (e) {}
    }
    function theme() { return document.documentElement.getAttribute('data-carino-theme') || 'gold'; }
    function lang() { return (window.CarinoLang && window.CarinoLang.current) || document.documentElement.lang || 'en'; }
    function snapshot() {
        let state = null;
        if (typeof MG.state === 'function') {
            const s = MG.state();
            state = { current: s.current, deferred: s.deferred, playing: s.playing, time: s.time,
                      duration: s.duration, queue: s.queue, filter: s.filter, filterLabel: s.filterLabel,
                      lyrics: s.lyrics, settings: s.settings };
        }
        post('snapshot', { state: state, mode: MG.settings.get('displayMode'), theme: theme(), lang: lang() });
    }

    /* the bus, passed on as is */
    ['track', 'playstate', 'queue', 'lyrics', 'lyricline', 'lyricsoffset', 'settings', 'filter', 'ended'].forEach(function (type) {
        MG.on(type, function (d) { post(type, d); });
    });
    MG.on('time', function (d) { last = d; post('time', d); });
    MG.on('playstate', function (d) { if (!d.playing) post('time', last); });
    MG.on('ready', snapshot);

    if (bc) {
        bc.onmessage = function (e) {
            const m = e.data;
            if (!m || m.src !== 'display') return;
            if (m.type === 'bye') { lastSeen = 0; syncUI(); return; }
            lastSeen = Date.now();
            /* the party lock: from the display too, only play when nothing plays */
            const lockedOut = function () {
                if (!(MG.lock && MG.lock.locked())) return false;
                if (MG.toast) MG.toast(tr('Party lock is on'));
                return true;
            };
            if (m.type === 'hello') snapshot();
            else if (m.type === 'mode') {
                if (!lockedOut()) setMode(m.mode);
                else post('settings', { key: 'displayMode', value: MG.settings.get('displayMode') });   /* put it back */
            }
            else if (m.type === 'cmd' && (m.action !== 'toggle' || (MG.state && MG.state().playing)) && lockedOut()) { /* ignored */ }
            else if (m.type === 'cmd') {
                if (m.action === 'toggle' && MG.toggle) MG.toggle();
                else if (m.action === 'next' && MG.next) MG.next();
                else if (m.action === 'prev' && MG.prev) MG.prev();
            }
            if (!wasConnected) syncUI();
        };
        setInterval(function () {
            post('beat', { playing: !!(MG.state && MG.state().playing), time: last.time, duration: last.duration });
            if (wasConnected !== connected()) syncUI();
        }, 1000);
        window.addEventListener('pagehide', function () { post('bye'); });
        /* the theme switch in the navbar, and the language */
        new MutationObserver(function () { post('theme', { theme: theme() }); })
            .observe(document.documentElement, { attributes: true, attributeFilter: ['data-carino-theme'] });
        window.addEventListener('carino:langchange', function () { setTimeout(function () { post('lang', { lang: lang() }); }, 0); });
    }

    function connected() { return !!lastSeen && Date.now() - lastSeen < ALIVE_MS; }

    /* Opens display.html in its own window — or, if one is open already
       (even from before this page was reloaded), brings it forward. */
    function open() {
        if (!bc) { if (MG.toast) MG.toast(tr('This browser cannot link a display window.')); return; }
        let w = win && !win.closed ? win : null;
        if (!w) {
            try { w = window.open('', NAME, FEATURES); } catch (e) { w = null; }
            if (!w) { if (MG.toast) MG.toast(tr('Allow pop-ups for this site to open the display.')); return; }
            let blank = true;
            try { blank = w.location.href === 'about:blank'; } catch (e) {}
            if (blank) w.location.href = new URL('display.html', location.href).href;
        }
        win = w;
        try { w.focus(); } catch (e) {}
        closePop();
    }
    function setMode(mode) {
        if (MODES.indexOf(mode) < 0) return;
        MG.settings.set('displayMode', mode);
    }
    function cycleMode() {
        const i = MODES.indexOf(MG.settings.get('displayMode'));
        setMode(MODES[(i + 1) % MODES.length]);
        if (MG.toast) MG.toast(tr('Display') + ': ' + tr(modeName(MG.settings.get('displayMode'))));
    }
    function modeName(m) { return m === 'karaoke' ? 'Karaoke' : m === 'ambient' ? 'Ambient' : 'Party'; }

    MG.display = { open: open, connected: connected, setMode: setMode, cycleMode: cycleMode, modes: MODES.slice() };

    /* ── The controls: 📺 in the player bar (a small pop-up) and
       ⚙ Settings → TV display. Both carry [data-display-*] hooks. ── */
    const $ = function (id) { return document.getElementById(id); };
    function popOpen() { const p = $('displayPop'); return !!p && !p.hidden; }
    function openPop() {
        const p = $('displayPop');
        if (!p) return;
        p.hidden = false;
        $('displayBtn').setAttribute('aria-expanded', 'true');
        syncUI();
        const first = p.querySelector('[data-display-open]');
        if (first) first.focus();
    }
    function closePop(focusBack) {
        const p = $('displayPop');
        if (!p || p.hidden) return;
        p.hidden = true;
        $('displayBtn').setAttribute('aria-expanded', 'false');
        if (focusBack) $('displayBtn').focus();
    }

    function syncUI() {
        const on = connected();
        const changed = on !== wasConnected;
        wasConnected = on;
        const mode = MG.settings.get('displayMode');
        document.querySelectorAll('[data-display-modes] [data-mode]').forEach(function (b) {
            const sel = b.dataset.mode === mode;
            b.setAttribute('aria-checked', sel ? 'true' : 'false');
            b.tabIndex = sel ? 0 : -1;
        });
        document.querySelectorAll('[data-display-modes]').forEach(function (g) { g.setAttribute('aria-label', tr('Display mode')); });
        document.querySelectorAll('[data-display-status]').forEach(function (el) {
            el.textContent = on ? tr('On the display now') : tr('No display open');
            el.classList.toggle('on', on);
        });
        document.querySelectorAll('[data-display-open-label]').forEach(function (el) {
            el.textContent = on ? tr('Show the display') : tr('Open display');
        });
        const btn = $('displayBtn');
        if (btn) {
            btn.classList.toggle('is-live', on);
            const label = tr('TV display') + (on ? ' · ' + tr(modeName(mode)) : '');
            btn.setAttribute('aria-label', label);
            btn.title = label + ' (D)';
        }
        if (changed) MG.emit('display', { connected: on, mode: mode });
    }

    document.addEventListener('DOMContentLoaded', function () {
        const btn = $('displayBtn');
        if (btn) btn.addEventListener('click', function (e) {
            e.stopPropagation();
            if (popOpen()) closePop();
            else if (!(MG.lock && MG.lock.locked())) openPop();
            else MG.lock.ask('display', openPop);
        });
        /* under the party lock these ask for the PIN first (party.js) */
        const guard = function (then) {
            if (!(MG.lock && MG.lock.locked())) return true;
            MG.lock.ask('display', then);
            return false;
        };
        document.querySelectorAll('[data-display-open]').forEach(function (b) {
            b.addEventListener('click', function () { if (guard(open)) open(); });
        });
        document.querySelectorAll('[data-display-modes]').forEach(function (group) {
            group.addEventListener('click', function (e) {
                const b = e.target.closest('[data-mode]');
                const go = function () { setMode(b.dataset.mode); };
                if (b && guard(go)) go();
            });
            /* a radio group: ←/→ move the choice */
            group.addEventListener('keydown', function (e) {
                if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
                e.preventDefault();
                e.stopPropagation();
                if (!guard()) return;
                const i = MODES.indexOf(MG.settings.get('displayMode'));
                setMode(MODES[(i + (e.key === 'ArrowRight' ? 1 : MODES.length - 1)) % MODES.length]);
                const sel = group.querySelector('[aria-checked="true"]');
                if (sel) sel.focus();
            });
        });
        const pop = $('displayPop');
        if (pop) {
            pop.addEventListener('keydown', function (e) {
                if (e.key === 'Escape') { e.stopPropagation(); closePop(true); }
            });
            document.addEventListener('pointerdown', function (e) {
                if (popOpen() && !e.target.closest('#displayPop') && !e.target.closest('#displayBtn')) closePop();
            });
        }
        MG.on('settings', function (d) {
            if (d.key === 'displayMode') syncUI();   /* the display hears it as 'settings' */
        });
        window.addEventListener('carino:langchange', function () { setTimeout(syncUI, 0); });
        if (!bc) document.querySelectorAll('[data-display-open]').forEach(function (b) { b.disabled = true; });
        syncUI();
        /* a display left open from before: it says hello on its next beat
           check; this asks it to answer now */
        post('ping');
    });
})();
