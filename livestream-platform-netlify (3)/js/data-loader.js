/**
 * Async master dataset loader.
 * Keeps the large session payload out of the parser-blocking JavaScript bundle.
 */
(function (window) {
  'use strict';

  const DataLoader = {
    source: 'bundled',
    error: null,

    async load() {
      try {
        const cached = localStorage.getItem('fyc_custom_sessions');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length) {
            window.MASTER_SESSIONS = parsed;
            this.source = 'local-cache';
            return parsed;
          }
        }
      } catch (err) {
        console.warn('Unable to read cached sessions:', err);
      }

      try {
        const response = await fetch('data/sessions.json', { cache: 'force-cache' });
        if (!response.ok) throw new Error(`Dataset request failed (${response.status})`);
        const sessions = await response.json();
        if (!Array.isArray(sessions)) throw new Error('Dataset payload is not an array');
        window.MASTER_SESSIONS = sessions;
        this.source = 'bundled-json';
        return sessions;
      } catch (err) {
        this.error = err;
        console.error('Master dataset failed to load:', err);
        window.MASTER_SESSIONS = window.MASTER_SESSIONS || [];
        return window.MASTER_SESSIONS;
      }
    }
  };

  DataLoader.ready = DataLoader.load();
  window.DataLoader = DataLoader;
})(window);
