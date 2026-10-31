/* MusicGrid — house-party pieces, on top of the bus (mg-core.js).
 *
 *   Party setup   "What's tonight?" — shown once per browser (and again
 *                 from ⚙ Settings → Party setup): Karaoke, Party or
 *                 Background set the right switches in one go; "Just
 *                 browse" changes nothing. A second step offers the TV
 *                 display and, for Party / Background, a list to start
 *                 (a click is the gesture the browser needs for sound).
 *                 A shared link (?v= ?q= ?s=) skips it; ?cat= puts that
 *                 list first. ?welcome=1 always shows it.
 *   Party lock    MusicGrid.lock — guests can search, add to Up next (and
 *                 take out their own), and start the music when nothing
 *                 plays; the rest asks for the PIN (grid.js calls
 *                 guard(what, then)). The right PIN unlocks for a minute
 *                 (HOST_MS) and runs what was asked. No PIN: the host holds
 *                 a button for two seconds. Saved in this browser
 *                 (settings.partyLock + mg_lock_pin), so a reload keeps it.
 *                 A light lock for a living room, not security.
 *   Wake lock     the screen stays on while music plays (taken again when
 *                 the tab comes back, since the browser drops it on hide)
 *   Announce      "Now playing" for screen readers (and a toast when the
 *                 next song starts by itself); the tab title is
 *                 ▶ Song — Artist while it plays.
 */
(function () {
    'use strict';

    const MG = window.MusicGrid;
    if (!MG) return;
    const S = MG.settings;
    const tr = function (k) { return typeof window.t === 'function' ? window.t(k) : k; };
    const $ = function (id) { return document.getElementById(id); };
    const HOST_MS = 60000;          /* unlocked by PIN: this long, then locks again */
    const HOLD_MS = 2000;           /* no PIN: hold the button this long */
    const TRIES = 5, COOLDOWN_MS = 30000;
    const PIN_KEY = 'mg_lock_pin';

    function store(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} }
    function read(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }

    /* ══ Party lock ════════════════════════════════════════════ */
    let hostUntil = 0, hostTimer = null, lastLocked = null, lastHost = null;
    function pin() { const p = read(PIN_KEY) || ''; return /^\d{4}$/.test(p) ? p : ''; }
    function lockOn() { return !!S.get('partyLock'); }
    function locked() { return lockOn() && Date.now() >= hostUntil; }
    function host() { return lockOn() && !locked(); }

    function setHost(ms) {
        hostUntil = ms ? Date.now() + ms : 0;
        clearInterval(hostTimer);
        hostTimer = ms ? setInterval(syncLock, 1000) : null;
        syncLock();
    }
    function syncLock() {
        if (hostTimer && Date.now() >= hostUntil) { clearInterval(hostTimer); hostTimer = null; hostUntil = 0; }
        const isLocked = locked(), isHost = host();
        document.body.classList.toggle('mg-locked', isLocked);
        document.body.classList.toggle('mg-host', isHost);
        const chip = $('lockChip');
        if (chip) {
            chip.hidden = !lockOn();
            chip.classList.toggle('is-host', isHost);
            const secs = Math.max(0, Math.ceil((hostUntil - Date.now()) / 1000));
            $('lockChipLabel').textContent = isHost ? tr('Unlocked') + ' · ' + secs + ' s' : tr('Locked');
            const label = isHost ? tr('Unlocked for a moment — click to lock again') : tr('Party lock is on — click to unlock');
            chip.title = label;
            chip.setAttribute('aria-label', label);
        }
        syncLockSettings();
        if (isLocked !== lastLocked || isHost !== lastHost) {
            lastLocked = isLocked; lastHost = isHost;
            MG.emit('lock', { locked: isLocked, host: isHost });
        }
    }

    function lock(newPin) {
        if (newPin != null) store(PIN_KEY, /^\d{4}$/.test(newPin) ? newPin : null);
        hostUntil = 0;
        S.set('partyLock', true);
        syncLock();
    }
    function unlock() { S.set('partyLock', false); setHost(0); }
    function relock() { setHost(0); }

    /* why the PIN is being asked */
    const WHY = {
        skip:     'Only the host can skip songs.',
        pause:    'Only the host can pause the music.',
        seek:     'Only the host can jump around in a song.',
        queue:    "Only the host can move or remove other people's songs.",
        settings: 'Only the host can change the settings.',
        sound:    'Only the host can change the volume.',
        list:     'Only the host can change the list.',
        display:  'Only the host can change the TV display.',
        unlock:   'Enter the PIN to unlock for a minute.',
    };

    /* ── The PIN dialog ─────────────────────────────────────── */
    let pending = null, entered = '', tries = 0, coolUntil = 0, pinFocus = null, holdTimer = null, coolTimer = null;
    function pinOpen() { return !$('pinScrim').hidden; }
    function ask(what, then) {
        pending = typeof then === 'function' ? then : null;
        const why = WHY[what] || WHY.unlock;
        $('pinWhy').textContent = tr(why) + (what === 'unlock' || !pin() ? '' : ' ' + tr('Enter the PIN to go ahead.'));
        if (pinOpen()) return;
        pinFocus = document.activeElement;
        entered = '';
        const hasPin = !!pin();
        $('pinEntry').hidden = !hasPin;
        $('pinHold').hidden = hasPin;
        $('pinScrim').hidden = false;
        renderDots();
        setPinMsg(coolUntil > Date.now() ? coolMsg() : '');
        requestAnimationFrame(function () {
            const first = hasPin ? $('pinPad').querySelector('button') : $('pinHoldBtn');
            if (first) first.focus();
        });
    }
    function closePin() {
        if (!pinOpen()) return;
        $('pinScrim').hidden = true;
        endHold(false);
        entered = '';
        if (pinFocus && pinFocus.focus && document.contains(pinFocus) && pinFocus !== document.body) pinFocus.focus();
        pinFocus = null;
    }
    function granted() {
        const then = pending;
        pending = null;
        tries = 0;
        closePin();
        setHost(HOST_MS);
        if (MG.toast) MG.toast(tr('Unlocked for a minute'));
        if (then) then();
    }
    function renderDots() {
        $('pinDots').querySelectorAll('span').forEach(function (d, i) { d.classList.toggle('on', i < entered.length); });
    }
    function setPinMsg(m) { $('pinMsg').textContent = m; }
    function coolMsg() { return tr('Too many tries. Wait a moment.') + ' ' + Math.ceil((coolUntil - Date.now()) / 1000) + ' s'; }
    function press(d) {
        if (coolUntil > Date.now()) { setPinMsg(coolMsg()); return; }
        if (d === 'back') { entered = entered.slice(0, -1); renderDots(); return; }
        if (entered.length >= 4) return;
        entered += d;
        renderDots();
        setPinMsg('');
        if (entered.length < 4) return;
        if (entered === pin()) { granted(); return; }
        tries++;
        const dots = $('pinDots');
        dots.classList.remove('wrong'); void dots.offsetWidth; dots.classList.add('wrong');
        setTimeout(function () { entered = ''; renderDots(); }, 380);
        if (tries >= TRIES) {
            tries = 0;
            coolUntil = Date.now() + COOLDOWN_MS;
            clearInterval(coolTimer);
            coolTimer = setInterval(function () {
                if (coolUntil <= Date.now()) { clearInterval(coolTimer); setPinMsg(''); return; }
                if (pinOpen()) setPinMsg(coolMsg());
            }, 1000);
            setPinMsg(coolMsg());
        } else setPinMsg(tr('Wrong PIN'));
    }
    /* no PIN: hold to unlock */
    function startHold() {
        if (holdTimer) return;
        $('pinHoldBtn').classList.add('holding');
        holdTimer = setTimeout(function () { holdTimer = null; endHold(false); granted(); }, HOLD_MS);
    }
    function endHold() {
        clearTimeout(holdTimer); holdTimer = null;
        const b = $('pinHoldBtn');
        if (b) b.classList.remove('holding');
    }

    /* ── Settings → Party ───────────────────────────────────── */
    function syncLockSettings() {
        const box = $('setLock'), field = $('setLockPin');
        if (!box || !field) return;
        box.checked = lockOn();
        field.disabled = lockOn();
        if (document.activeElement !== field) field.value = pin();
        field.classList.remove('bad');
        const t = S.get('tonight');
        const v = $('setTonightVal');
        if (v) {
            if (!v.dataset.base) v.dataset.base = 'Karaoke, party or background music: the right switches in one go.';
            const name = { karaoke: '🎤 ' + tr('Karaoke'), party: '🎉 ' + tr('Party'), background: '🎵 ' + tr('Background') }[t];
            v.textContent = name ? tr('Tonight') + ': ' + name : tr(v.dataset.base);
        }
    }
    function wireLockSettings() {
        const box = $('setLock'), field = $('setLockPin');
        field.addEventListener('input', function () {
            field.value = field.value.replace(/\D/g, '').slice(0, 4);
            field.classList.remove('bad');
        });
        field.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); box.click(); } });
        box.addEventListener('change', function () {
            if (box.checked) {
                const p = field.value.trim();
                if (p && !/^\d{4}$/.test(p)) {
                    box.checked = false;
                    field.classList.add('bad');
                    field.focus();
                    if (MG.toast) MG.toast(tr('The PIN needs 4 digits.'));
                    return;
                }
                lock(p);
                if (MG.toast) MG.toast(p ? tr('Party lock is on') : tr('Party lock is on — no PIN, hold to unlock'));
            } else {
                unlock();
                if (MG.toast) MG.toast(tr('Party lock is off'));
            }
        });
        $('setTonight').addEventListener('click', function () {
            if (MG.closeSettings) MG.closeSettings();
            openWelcome();
        });
    }

    /* ══ Party setup ("What's tonight?") ═══════════════════════ */
    const PRESETS = {
        karaoke:    { autoplay: true, shuffle: false, lyrics: true,  displayMode: 'karaoke' },
        party:      { autoplay: true, shuffle: true,  lyrics: false, displayMode: 'party' },
        background: { autoplay: true, shuffle: true,  lyrics: false, displayMode: 'ambient', wallMotion: true },
    };
    const BACKGROUND_VOLUME = 40;
    function applyPreset(name) {
        const p = PRESETS[name];
        S.set('tonight', name);
        if (!p) return;
        Object.keys(p).forEach(function (k) { S.set(k, p[k], 'preset'); });
        if (name === 'background' && S.get('volume') > BACKGROUND_VOLUME) S.set('volume', BACKGROUND_VOLUME, 'preset');
    }

    /* the lists offered in step 2, built from the catalog like the Lists dialog */
    /* catalog.json declares these with const: globals, but not on window */
    function registry(reg) {
        if (reg === 'COUNTRIES') return typeof COUNTRIES !== 'undefined' ? COUNTRIES : {};
        if (reg === 'GENRES') return typeof GENRES !== 'undefined' ? GENRES : {};
        return typeof MOODS !== 'undefined' ? MOODS : {};
    }
    function meta(reg, id, fallback) { return registry(reg)[id] || fallback; }
    function countBy(albums, key) {
        const c = {};
        albums.forEach(function (a) { [].concat(a[key] || []).forEach(function (v) { c[v] = (c[v] || 0) + 1; }); });
        return Object.keys(c).sort(function (a, b) { return c[b] - c[a]; }).map(function (id) { return { id: id, count: c[id] }; });
    }
    function listLabel(type, value) {
        if (type === 'all') return tr('All songs');
        if (type === 'carino') return '★ Carino';
        if (type === 'meme') return '😂 ' + tr('Meme');
        if (type === 'party' || type === 'country') {
            const m = meta('COUNTRIES', value, { name: value, flag: '🏳️' });
            return (type === 'party' ? '🎉 ' : m.flag + ' ') + m.name;
        }
        if (type === 'genre') { const m = meta('GENRES', value, { name: value, icon: '🎵' }); return m.icon + ' ' + m.name; }
        if (type === 'mood') { const m = meta('MOODS', value, { name: value, icon: '🎭' }); return m.icon + ' ' + m.name; }
        return value;
    }
    function listKind(type) {
        return { all: tr('Everything'), carino: tr('Personal picks'), party: tr('Party list'),
                 country: tr('Country'), genre: tr('Genre'), mood: tr('Mood'), meme: tr('Lists') }[type] || '';
    }
    function matches(a, type, value) {
        if (type === 'all') return true;
        if (type === 'carino') return !!a.carino;
        if (type === 'meme') return !!a.meme;
        return [].concat(a[type] || []).indexOf(value) >= 0;
    }
    function offeredLists(preset) {
        const albums = MG.albums ? MG.albums() : [];
        const out = [];
        const add = function (type, value) {
            if (out.some(function (o) { return o.type === type && o.value === value; })) return;
            const n = albums.filter(function (a) { return matches(a, type, value); }).length;
            if (n) out.push({ type: type, value: value, count: n });
        };
        /* a ?cat= link names the list: it comes first */
        const cur = MG.state ? MG.state().filter : null;
        if (cur && cur.type !== 'all') add(cur.type, cur.value || '');
        if (preset === 'party') {
            add('carino', '');
            countBy(albums, 'party').slice(0, 5).forEach(function (x) { add('party', x.id); });
            countBy(albums, 'genre').slice(0, 4).forEach(function (x) { add('genre', x.id); });
            add('all', '');
        } else {
            add('all', '');
            add('carino', '');
            countBy(albums, 'mood').slice(0, 4).forEach(function (x) { add('mood', x.id); });
            countBy(albums, 'genre').slice(0, 3).forEach(function (x) { add('genre', x.id); });
        }
        return out.slice(0, 10).map(function (o) {
            const covers = [];
            for (let i = 0; i < albums.length && covers.length < 4; i++) {
                const a = o.type === 'all' ? albums[Math.floor(i * albums.length / 4) % albums.length] : albums[i];
                if (matches(a, o.type, o.value) && covers.indexOf(a.image) < 0) covers.push(a.image);
            }
            return Object.assign(o, { label: listLabel(o.type, o.value), covers: covers });
        });
    }

    let wPreset = '', wFocus = null;
    function welcomeOpen() { return !$('welcome').hidden; }
    function openWelcome() {
        const w = $('welcome');
        if (!welcomeOpen()) wFocus = document.activeElement;
        showStep(1);
        w.hidden = false;
        /* focus rests on the dialog itself, so no card looks picked; Tab
           or an arrow key moves onto the cards */
        requestAnimationFrame(function () { w.classList.add('open'); w.querySelector('.mg-welcome').focus(); });
    }
    function closeWelcome(then) {
        const w = $('welcome');
        if (!welcomeOpen()) return;
        w.classList.remove('open');
        w.hidden = true;
        if (typeof then === 'function') then();
        else if (wFocus && wFocus.focus && document.contains(wFocus) && wFocus !== document.body) wFocus.focus();
        wFocus = null;
    }
    function markSeen() { if (S.get('tonight') === '') S.set('tonight', 'browse'); }
    function showStep(n) {
        $('welcome').querySelectorAll('.mg-welcome-step').forEach(function (s) { s.hidden = +s.dataset.step !== n; });
        $('welcome').dataset.step = String(n);
        $('welcome').querySelectorAll('.mg-wcard').forEach(function (c) {
            c.setAttribute('aria-pressed', c.dataset.preset === S.get('tonight') ? 'true' : 'false');
        });
    }
    function pickPreset(name) {
        wPreset = name;
        applyPreset(name);
        renderStep2();
        showStep(2);
        requestAnimationFrame(function () {
            const first = name === 'karaoke' ? $('welcomeGo') : $('welcomeLists').querySelector('.mg-wlist');
            (first || $('welcomeGo')).focus();
        });
    }
    function renderStep2() {
        const p = wPreset;
        const icon = { karaoke: '🎤', party: '🎉', background: '🎵' }[p];
        const name = { karaoke: tr('Karaoke'), party: tr('Party'), background: tr('Background') }[p];
        $('welcomeKicker2').textContent = icon + ' ' + name + ' · ' + tr('All set');
        const lists = $('welcomeLists');
        lists.innerHTML = '';
        $('welcomeHowto').hidden = p !== 'karaoke';
        lists.hidden = p === 'karaoke';
        $('welcomeTip').hidden = p === 'background';
        const go = $('welcomeGo');
        if (p === 'karaoke') {
            $('welcomeTitle2').textContent = tr('Who sings first?');
            $('welcomeSub2').textContent = tr('Lyrics are on, and songs play in the order they are added. Put the TV display on the big screen so everyone can sing.');
            go.innerHTML = '<svg class="mg-i" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg> ';
            go.append(tr('Search a song'));
            go.onclick = function () {
                closeWelcome(function () {
                    const input = $('searchInput');
                    if (input) input.focus();   /* grid.js opens the results on focus */
                });
            };
            return;
        }
        $('welcomeTitle2').textContent = tr('What should play?');
        $('welcomeSub2').textContent = p === 'party'
            ? tr('Pick a list and the music starts, shuffled and non-stop. Guests can add songs to Up next any time.')
            : tr('Pick a list and the music starts, quietly and shuffled.');
        lists.setAttribute('aria-label', tr('What should play?'));
        const items = offeredLists(p);
        items.forEach(function (it) {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'mg-wlist';
            const mosaic = document.createElement('span');
            mosaic.className = 'mg-wlist-mosaic';
            mosaic.setAttribute('aria-hidden', 'true');
            it.covers.forEach(function (img) {
                const im = document.createElement('img');
                im.src = 'assets/covers/' + img; im.alt = ''; im.loading = 'lazy';
                mosaic.appendChild(im);
            });
            const nm = document.createElement('span');
            nm.className = 'mg-wlist-name';
            nm.textContent = it.label;
            const sub = document.createElement('span');
            sub.className = 'mg-wlist-sub';
            sub.textContent = listKind(it.type) + ' · ' + it.count + ' ' + tr('songs');
            const play = document.createElement('span');
            play.className = 'mg-wlist-play';
            play.setAttribute('aria-hidden', 'true');
            play.innerHTML = '<svg viewBox="0 0 24 24"><polygon points="8 5 19 12 8 19 8 5"/></svg>';
            b.append(mosaic, nm, sub, play);
            b.setAttribute('aria-label', tr('Play') + ': ' + it.label + ', ' + it.count + ' ' + tr('songs'));
            b.addEventListener('click', function () { startList(it); });
            lists.appendChild(b);
        });
        const first = items[0];
        go.textContent = '';
        go.innerHTML = '<svg class="mg-i fill" viewBox="0 0 24 24" aria-hidden="true"><polygon points="8 5 19 12 8 19 8 5"/></svg> ';
        go.append(first ? tr('Play') + ' ' + first.label : tr('Play'));
        go.onclick = function () { if (first) startList(first); else closeWelcome(); };
    }
    /* a click on a list: the wall shows it and the music starts (this
       click is the gesture the browser wants before it plays sound) */
    function startList(it) {
        if (MG.setFilter) MG.setFilter(it.type, it.value);
        closeWelcome();
        const st = MG.state ? MG.state() : null;
        if (MG.next) MG.next();
        if (st && st.current && MG.toast) MG.toast(tr('Now playing from') + ' ' + it.label);
    }

    function wireWelcome() {
        const w = $('welcome');
        w.querySelectorAll('.mg-wcard').forEach(function (c) {
            c.addEventListener('click', function () { pickPreset(c.dataset.preset); });
        });
        $('welcomeSkip').addEventListener('click', function () { markSeen(); closeWelcome(); });
        $('welcomeBack').addEventListener('click', function () {
            showStep(1);
            const c = w.querySelector('.mg-wcard[data-preset="' + wPreset + '"]');
            if (c) c.focus();
        });
        $('welcomeX').addEventListener('click', function () { closeWelcome(); });
        w.addEventListener('click', function (e) { if (e.target === w) { markSeen(); closeWelcome(); } });
        /* arrows move between the choices */
        w.addEventListener('keydown', function (e) {
            const k = e.key;
            if (!/^Arrow/.test(k)) return;
            const set = Array.prototype.slice.call(w.querySelectorAll(
                w.dataset.step === '1' ? '.mg-wcard' : '.mg-wlist'));
            const i = set.indexOf(document.activeElement);
            if (!set.length) return;
            e.preventDefault();
            if (i < 0) {   /* nothing picked yet: the current choice, else the first */
                (set.filter(function (x) { return x.getAttribute('aria-pressed') === 'true'; })[0] || set[0]).focus();
                return;
            }
            let cols = 1;
            if (set.length > 1) { const t0 = set[0].getBoundingClientRect().top; cols = set.filter(function (x) { return Math.abs(x.getBoundingClientRect().top - t0) < 4; }).length || 1; }
            const d = k === 'ArrowRight' ? 1 : k === 'ArrowLeft' ? -1 : k === 'ArrowDown' ? cols : -cols;
            const j = Math.max(0, Math.min(set.length - 1, i + d));
            set[j].focus();
        });
    }

    /* ── Keys while a dialog of ours is open ────────────────── */
    /* Capture phase: Tab stays inside, Esc closes, digits type the PIN.
       Keys inside the dialog work as usual but stop there, so grid.js's
       shortcuts never see them. */
    function activeDialog() { return pinOpen() ? $('pinScrim') : welcomeOpen() ? $('welcome') : null; }
    function focusables(root) {
        return Array.prototype.filter.call(root.querySelectorAll('button,input,a[href],[tabindex]:not([tabindex="-1"])'),
            function (el) { return !el.disabled && el.offsetParent !== null; });
    }
    function onKeyCapture(e) {
        const dlg = activeDialog();
        if (!dlg) return;
        const k = e.key;
        if (k === 'Escape') {
            e.preventDefault(); e.stopPropagation();
            if (dlg === $('pinScrim')) { pending = null; closePin(); }
            else if ($('welcome').dataset.step === '2') { closeWelcome(); }
            else { markSeen(); closeWelcome(); }
            return;
        }
        if (k === 'Tab') {
            const f = focusables(dlg);
            if (!f.length) return;
            const first = f[0], last = f[f.length - 1];
            if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
            else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
            else if (!dlg.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
            e.stopPropagation();
            return;
        }
        if (dlg === $('pinScrim') && !$('pinEntry').hidden && !e.ctrlKey && !e.metaKey && !e.altKey) {
            if (/^[0-9]$/.test(k)) { e.preventDefault(); e.stopPropagation(); press(k); return; }
            if (k === 'Backspace') { e.preventDefault(); e.stopPropagation(); press('back'); return; }
        }
        if (!dlg.contains(e.target)) { e.stopPropagation(); if (k === ' ' || k === 'Enter') e.preventDefault(); }
    }

    function wirePin() {
        $('pinPad').addEventListener('click', function (e) {
            const b = e.target.closest('button[data-d]');
            if (b) press(b.dataset.d);
        });
        $('pinX').addEventListener('click', function () { pending = null; closePin(); });
        $('pinScrim').addEventListener('click', function (e) { if (e.target === e.currentTarget) { pending = null; closePin(); } });
        const hb = $('pinHoldBtn');
        hb.addEventListener('pointerdown', function (e) { e.preventDefault(); startHold(); });
        ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (t) { hb.addEventListener(t, function () { endHold(); }); });
        hb.addEventListener('keydown', function (e) { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); startHold(); } });
        hb.addEventListener('keyup', function (e) { if (e.key === ' ' || e.key === 'Enter') endHold(); });
        hb.addEventListener('contextmenu', function (e) { e.preventDefault(); });
        $('lockChip').addEventListener('click', function () {
            if (host()) { relock(); if (MG.toast) MG.toast(tr('Party lock is on')); }
            else ask('unlock', null);
        });
    }

    /* the dialogs and the bubble phase: keys inside stop here */
    function stopInside(el) { el.addEventListener('keydown', function (e) { e.stopPropagation(); }); }

    /* Leaving the page under the lock asks first (the browser's own
       "Leave site?"), so a guest doesn't close the music by accident. */
    window.addEventListener('beforeunload', function (e) {
        if (!locked() || !MG.state || !MG.state().current) return;
        e.preventDefault();
        e.returnValue = '';
    });

    /* ══ Screen wake lock ══════════════════════════════════════ */
    let playing = false, wake = null, wakeAsking = false;
    function syncWake() {
        if (!('wakeLock' in navigator)) return;
        const want = playing && document.visibilityState === 'visible';
        if (want && !wake && !wakeAsking) {
            wakeAsking = true;
            navigator.wakeLock.request('screen').then(function (w) {
                wakeAsking = false;
                wake = w;
                w.addEventListener('release', function () { if (wake === w) wake = null; });
                if (!(playing && document.visibilityState === 'visible')) { wake = null; w.release().catch(function () {}); }
            }, function () { wakeAsking = false; });
        } else if (!want && wake) {
            const w = wake; wake = null;
            w.release().catch(function () {});
        }
    }
    document.addEventListener('visibilitychange', syncWake);

    /* ══ Now playing: screen readers, a toast, the tab title ═══ */
    let baseTitle = document.title, titleAlbum = null;   /* carino-lang.js has translated it by now */
    function syncTitle() {
        if (!titleAlbum) { if (baseTitle) document.title = baseTitle; return; }
        const st = MG.splitTag(titleAlbum);
        const text = st.title + (st.artist ? ' — ' + st.artist : '');
        document.title = (playing ? '▶ ' : '❚❚ ') + text;
    }
    MG.on('track', function (d) {
        titleAlbum = d.album || null;
        syncTitle();
        if (!d.album || d.deferred) return;
        const st = MG.splitTag(d.album);
        const line = tr('Now playing') + ': ' + st.title + (st.artist ? ' — ' + st.artist : '');
        const live = $('mgAnnounce');
        if (live) { live.textContent = ''; setTimeout(function () { live.textContent = line; }, 60); }
        /* a song that started by itself (Up next, the shuffle) gets a toast;
           one picked by hand doesn't need telling */
        if ((d.from === 'queue' || d.from === 'shuffle') && MG.toast) MG.toast(tr('Now playing'), d.album);
    });
    MG.on('playstate', function (d) {
        playing = !!d.playing;
        syncTitle();
        syncWake();
    });
    MG.on('settings', function (d) {
        if (d.key === 'partyLock') { if (!d.value) hostUntil = 0; syncLock(); }
        else if (d.key === 'tonight') syncLockSettings();
    });

    MG.lock = { locked: locked, host: host, ask: ask, lock: lock, unlock: unlock, relock: relock };
    MG.setup = { open: openWelcome, close: closeWelcome, isOpen: welcomeOpen, apply: applyPreset };

    document.addEventListener('DOMContentLoaded', function () {
        if (!$('welcome') || !$('pinScrim')) return;
        wireWelcome();
        wirePin();
        wireLockSettings();
        stopInside($('welcome'));
        stopInside($('pinScrim'));
        document.addEventListener('keydown', onKeyCapture, true);
        window.addEventListener('carino:langchange', function () {
            setTimeout(function () {
                if (!/^(▶|❚❚) /.test(document.title)) baseTitle = document.title;
                syncTitle();
                syncLock();
                if (welcomeOpen() && $('welcome').dataset.step === '2') renderStep2();
            }, 0);
        });
        syncLock();
    });
    MG.on('ready', function () {
        syncLock();
        /* first visit: the party setup — unless a shared link already says
           what to play (?v= ?q= ?s=); ?welcome=1 always shows it */
        const p = new URLSearchParams(location.search);
        const seen = read('mg_tonight') !== null;
        const shared = p.has('v') || p.has('q') || p.has('s');
        if (p.get('welcome') === '1' || (!seen && !shared && !locked())) openWelcome();
    });
})();
