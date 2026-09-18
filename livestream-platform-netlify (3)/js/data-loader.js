/**
 * Authenticated private dataset loader.
 * Session data is fetched from Supabase only after a mapped user signs in.
 */
(function(window) {
  'use strict';

  const PAGE_SIZE = 1000;
  const SELECT_COLUMNS = [
    'id','date','brand','start','end','duration','platform','host','gmv','gmv_hr',
    'product','ctr','ctor','ads_cost','views','followers','sold_qty','buyer'
  ].join(',');

  function normalizeSession(row) {
    const numeric = ['duration','gmv','gmv_hr','ctr','ctor','ads_cost','views','followers','sold_qty','buyer'];
    const next = { ...row };
    numeric.forEach(key => { next[key] = Number(next[key] || 0); });
    return next;
  }

  const DataLoader = {
    source: 'private-supabase',
    error: null,
    ready: Promise.resolve([]),

    clearSensitiveCache() {
      try {
        localStorage.removeItem('fyc_custom_sessions');
      } catch (_) {}
    },

    async loadAuthenticated() {
      this.error = null;
      this.clearSensitiveCache();

      if (!window.SupabaseAuth?.isAuthenticated?.()) {
        window.MASTER_SESSIONS = [];
        throw new Error('Authentication required before loading private session data.');
      }

      const mapped = await window.SupabaseAuth.bindLocalAccount();
      if (!mapped) {
        window.MASTER_SESSIONS = [];
        throw new Error('This login is not authorized for the FYC dashboard.');
      }

      const sessions = [];
      for (let offset = 0; ; offset += PAGE_SIZE) {
        const path =
          `livestream_sessions?select=${encodeURIComponent(SELECT_COLUMNS)}&order=date.asc,start.asc,id.asc&limit=${PAGE_SIZE}&offset=${offset}`;
        const page = await window.SupabaseEngine.request(path, { method: 'GET' });
        if (!Array.isArray(page)) throw new Error('Private dataset response is invalid.');

        sessions.push(...page.map(normalizeSession));
        if (page.length < PAGE_SIZE) break;
      }

      if (!sessions.length) throw new Error('No authorized session data was returned.');

      window.MASTER_SESSIONS = sessions;
      window.AppStore?.invalidate?.();
      this.source = 'private-supabase';
      return sessions;
    },

    load() {
      this.ready = this.loadAuthenticated().catch(err => {
        this.error = err;
        window.MASTER_SESSIONS = [];
        throw err;
      });
      return this.ready;
    }
  };

  DataLoader.clearSensitiveCache();
  window.DataLoader = DataLoader;
})(window);
