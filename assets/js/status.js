/* ============================================================
   status.js — the "Status" library readout for Music Grid
   ------------------------------------------------------------
   The navbar itself is the shared carino-navbar.js (clock and
   greeting included); this file only drives the Status dropdown
   that rides in its right cluster, and the live library stats.
   grid.js feeds it the playing track / active filter / queue size
   through window.CarinoNav.*.
   ============================================================ */
(function () {
    'use strict';

    function $(sel) { return document.querySelector(sel); }
    function set(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }

    /* ── The diag "Local time" (the navbar has its own clock) ── */
    const pad = n => String(n).padStart(2, '0');
    function tick() {
        const d = new Date();
        set('diagClock', [d.getHours(), d.getMinutes(), d.getSeconds()].map(pad).join(':'));
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
        filter(label) { set('diagFilter', label || t('All')); },
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
