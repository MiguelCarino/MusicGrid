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

    /* ── Live clock + greeting ──────────────────────────────── */
    function tick() {
        const d = new Date();
        const t = [d.getHours(), d.getMinutes(), d.getSeconds()]
            .map(n => String(n).padStart(2, '0')).join(':');
        set('clockLocal', t);
        set('diagClock', t);
        try {
            const tz = Intl.DateTimeFormat().resolvedOptions().timeZone.split('/').pop();
            set('tzName', tz || 'LOCAL');
        } catch (e) { set('tzName', 'LOCAL'); }
        const h = d.getHours();
        set('greeting',
            h < 5  ? 'Burning the midnight oil.' :
            h < 12 ? 'Good morning.' :
            h < 18 ? 'Good afternoon.' : 'Good evening.');
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
        tick();
        setInterval(tick, 1000);
        libraryStats();
    });
})();
