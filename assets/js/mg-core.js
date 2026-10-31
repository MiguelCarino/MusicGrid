/* MusicGrid core — the one shared bus and the saved settings.
 *
 * Everything that plays, queues or shows a song talks through here, so the
 * later pieces (a TV display window, party modes, guest requests) can plug
 * in without reaching into grid.js. grid.js fills in the actions when it
 * starts and then fires 'ready'.
 *
 *   MusicGrid.on(type, fn)        fn(detail) for every event of that type;
 *                                 returns a function that unsubscribes
 *   MusicGrid.emit(type, detail)
 *   MusicGrid.settings.get(key) / .set(key, value) / .all()
 *                                 saved in this browser; a change fires
 *                                 'settings' { key, value, from }. Keys:
 *                                 autoplay, shuffle, lyrics, muted, volume,
 *                                 wallMotion, displayMode ('karaoke' | 'party' |
 *                                 'ambient'), smooth (fade songs in and out),
 *                                 partyLock (the guest lock is on), tonight
 *                                 (the party setup picked: '' | 'karaoke' |
 *                                 'party' | 'background' | 'browse').
 *                                 set(key, value, from): from tags the change
 *                                 ('preset' from the party setup)
 *   MusicGrid.fold(text)          lower case, accents removed (search)
 *   MusicGrid.splitTag(album)     { artist, title } from "Artist — Title"
 *
 * Events (detail):
 *   ready      { albums }                     grid.js is up
 *   track      { album, deferred, from }      the song in the player changed
 *                                             (album null: nothing loaded);
 *                                             from: 'wall' | 'search' | 'queue' |
 *                                             'shuffle' | 'history' | 'url' | 'api'
 *   playstate  { playing, state }             state: 'playing' | 'paused' |
 *                                             'buffering' | 'ended' | 'idle'
 *   time       { time, duration }             about 4× a second while playing
 *   queue      { queue, reason, album, from } reason: 'add' | 'next' | 'remove' |
 *                                             'move' | 'clear' | 'advance' | 'restore'
 *   filter     { filter, label, count }       the wall's list changed
 *   lyrics     { cues, notes }                the song's lyrics arrived (or
 *                                             notes: none, music notes instead)
 *   lyricline  { index, cue }                 the line being sung now
 *   lyricsoffset { offset }                   the song's lyrics timing changed
 *                                             (seconds; + shows lines sooner)
 *   ended      { album }                      a song played to its end
 *   settings   { key, value }
 *   display    { connected, mode }            the TV display window came or went
 *                                             (assets/js/display-link.js)
 *   unavailable { album, reason, code }       a song would not play and was
 *                                             skipped: reason 'error' (YouTube
 *                                             onError code) or 'stall'
 *   stall      { album }                      no progress for a while: retrying
 *   lock       { locked, host }               the party lock changed (party.js);
 *                                             host: unlocked for a moment by PIN
 *
 * Actions (set by grid.js): play(albumOrUrl, opts), toggle(), next(), prev(),
 * seek(seconds), enqueue(albumOrUrl, { next, from }), removeAt(i),
 * move(from, to), clearQueue(), setFilter(type, value), setVolume(0–100),
 * setMuted(bool), state(), albums(), albumByUrl(url), search(query, limit).
 * MusicGrid.display (display-link.js): open(), connected(), setMode(mode),
 * cycleMode().
 * MusicGrid.lock (party.js): locked(), ask(what, then) — asks for the PIN
 * and runs then() once the host unlocks; lock(pin), unlock(), relock().
 * MusicGrid.setup (party.js): open() — the "What's tonight?" party setup.
 */
(function () {
    'use strict';

    const bus = new EventTarget();

    /* key → [localStorage key, default, how it is stored]. The first four
       keep the keys and encodings the site has always used. */
    const PREFS = {
        autoplay:   ['mg_autoplay', false, 'flag'],      /* '1' on */
        shuffle:    ['mg_shuffle',  true,  'flagOff'],   /* '0' off, else on */
        lyrics:     ['mg_lyrics',   false, 'flag'],
        muted:      ['mg_muted',    false, 'flag'],
        volume:     ['mg_volume',   100,   'int'],
        wallMotion: ['mg_wall',     true,  'flagOff'],
        /* what the TV display window (display.html) shows */
        displayMode: ['mg_display_mode', 'party', ['karaoke', 'party', 'ambient']],
        /* house-party pieces (party.js) */
        smooth:     ['mg_smooth',   true,  'flagOff'],   /* fade songs in and out */
        partyLock:  ['mg_lock',     false, 'flag'],      /* guests can't skip / change */
        tonight:    ['mg_tonight',  '', ['', 'karaoke', 'party', 'background', 'browse']],
    };
    const values = {};
    function load(key) {
        const p = PREFS[key];
        let raw = null;
        try { raw = localStorage.getItem(p[0]); } catch (e) {}
        if (raw === null) return p[1];
        if (p[2] === 'flag') return raw === '1';
        if (p[2] === 'flagOff') return raw !== '0';
        if (Array.isArray(p[2])) return p[2].indexOf(raw) >= 0 ? raw : p[1];
        const n = parseInt(raw, 10);
        return isNaN(n) ? p[1] : Math.max(0, Math.min(100, n));
    }
    Object.keys(PREFS).forEach(function (k) { values[k] = load(k); });

    const settings = {
        get: function (key) { return values[key]; },
        all: function () { return Object.assign({}, values); },
        set: function (key, value, from) {
            const p = PREFS[key];
            if (!p) return;
            if (Array.isArray(p[2])) { if (p[2].indexOf(value) < 0) return; }   /* one of a list */
            else if (p[2] === 'int') value = Math.max(0, Math.min(100, Math.round(+value || 0)));
            else value = !!value;
            if (values[key] === value) return;
            values[key] = value;
            try { localStorage.setItem(p[0], typeof value === 'boolean' ? (value ? '1' : '0') : String(value)); } catch (e) {}
            emit('settings', from ? { key: key, value: value, from: from } : { key: key, value: value });
        },
    };

    function emit(type, detail) {
        bus.dispatchEvent(new CustomEvent(type, { detail: detail || {} }));
    }
    function on(type, fn) {
        const h = function (e) { fn(e.detail, e); };
        bus.addEventListener(type, h);
        return function () { bus.removeEventListener(type, h); };
    }

    const fold = function (s) {
        return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    };
    function splitTag(album) {
        const tag = (album && album.tag) || '';
        const i = tag.indexOf(' — ');
        return i >= 0 ? { artist: tag.slice(0, i), title: tag.slice(i + 3) } : { artist: '', title: tag };
    }

    window.MusicGrid = Object.assign(window.MusicGrid || {}, {
        on: on, emit: emit, settings: settings, fold: fold, splitTag: splitTag,
    });
})();
