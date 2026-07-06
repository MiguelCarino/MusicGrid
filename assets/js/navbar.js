/* ============================================================
   navbar.js — Carino navbar for Music Grid
   ------------------------------------------------------------
   Self-contained: live clock + greeting, the "Status" diagnostics
   dropdown, and live library stats. grid.js feeds it the playing
   track / active filter / queue size through window.CarinoNav.*.
   No external dependencies (does NOT need carino.systems).
   ============================================================ */
(function () {
    'use strict';

    function $(sel) { return document.querySelector(sel); }
    function set(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }

    /* ── Live clock + greeting (click clock to cycle Local/UTC/Epoch) ── */
    let clockMode = 0; // 0 = local, 1 = UTC, 2 = epoch
    let localTz = 'LOCAL';
    try { localTz = Intl.DateTimeFormat().resolvedOptions().timeZone.split('/').pop() || 'LOCAL'; } catch (e) { localTz = 'LOCAL'; }
    const pad = n => String(n).padStart(2, '0');
    function tick() {
        const d = new Date();
        const local = [d.getHours(), d.getMinutes(), d.getSeconds()].map(pad).join(':');
        let t, tz;
        if (clockMode === 1)      { t = [d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()].map(pad).join(':'); tz = 'UTC'; }
        else if (clockMode === 2) { t = String(Math.floor(d.getTime() / 1000)); tz = 'EPOCH'; }
        else                      { t = local; tz = localTz; }
        set('clockLocal', t);
        set('diagClock', local);
        set('tzName', tz);
        const h = d.getHours();
        set('greeting',
            h < 5  ? 'Burning the midnight oil.' :
            h < 12 ? 'Good morning.' :
            h < 18 ? 'Good afternoon.' : 'Good evening.');
    }
    function wireClock() {
        const box = $('.header-clock');
        if (!box) return;
        box.style.cursor = 'pointer';
        box.title = 'Click to toggle Local / UTC / Epoch';
        box.addEventListener('click', function () { clockMode = (clockMode + 1) % 3; tick(); });
    }

    /* ── Library stats (derived from the catalog) ───────────── */
    function libraryStats() {
        if (typeof albums === 'undefined' || !Array.isArray(albums)) return;
        const countries = new Set();
        let carino = 0;
        albums.forEach(a => {
            if (a.country) countries.add(a.country);
            if (a.carino) carino++;
        });
        set('diagSongs', albums.length);
        set('diagCountries', countries.size);
        set('diagCarino', carino);
    }

    /* ── Public API for grid.js ─────────────────────────────── */
    window.CarinoNav = {
        nowPlaying(title, countryLabel) {
            set('diagNow', title || '—');
            set('diagNowCountry', countryLabel || '—');
        },
        filter(label) { set('diagFilter', label || 'All'); },
        queue(n) { set('diagQueue', n || 0); },
        refresh: libraryStats
    };

    /* ── Diagnostics dropdown ───────────────────────────────── */
    function wireDiag() {
        const toggle = $('#diagToggle');
        const box = $('#diagBox');
        if (!toggle || !box) return;
        function syncAria() {
            toggle.setAttribute('aria-expanded', box.classList.contains('open') ? 'true' : 'false');
        }
        toggle.addEventListener('click', function (e) {
            e.stopPropagation();
            box.classList.toggle('open');
            syncAria();
        });
        document.addEventListener('click', function (e) {
            if (box.classList.contains('open') && !box.contains(e.target) && !toggle.contains(e.target)) {
                box.classList.remove('open');
                syncAria();
            }
        });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && box.classList.contains('open')) {
                box.classList.remove('open');
                syncAria();
            }
        });
    }

    document.addEventListener('DOMContentLoaded', function () {
        wireDiag();
        wireClock();
        tick();
        setInterval(tick, 1000);
        libraryStats();
    });
})();
