/**
 * Required Supabase Auth runtime.
 * Dashboard access is granted only to authenticated users mapped to sub_accounts.auth_user_id.
 */
(function(window) {
  'use strict';

  const STORAGE_KEY = 'fyc_supabase_auth_session';
  const DEFAULT_CONFIG = {
    url: 'https://htckrzrpukospxokkgvd.supabase.co',
    anonKey: 'sb_publishable__ZXAk3Mj4U6zWwjQqIuvsg_JZrLbiQT'
  };

  const SupabaseAuth = {
    session: null,
    ready: Promise.resolve(),

    init() {
      try {
        // Production backend is fixed. Never trust a browser-stored endpoint/key override.
        localStorage.setItem('fyc_supabase_config', JSON.stringify(DEFAULT_CONFIG));

        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed?.access_token && parsed?.user) this.session = parsed;
        }
      } catch (err) {
        console.warn('Unable to restore Supabase auth session:', err);
        localStorage.removeItem(STORAGE_KEY);
      }

      this.ready = this.ensureFreshSession();
      return this.ready;
    },

    getConfig() {
      return { ...DEFAULT_CONFIG };
    },

    getAccessToken() {
      return this.session?.access_token || '';
    },

    getUser() {
      return this.session?.user || null;
    },

    isAuthenticated() {
      return !!(this.session?.access_token && this.session?.user);
    },

    isExpiringSoon() {
      if (!this.session?.expires_at) return false;
      return Number(this.session.expires_at) * 1000 - Date.now() < 120000;
    },

    persist(session) {
      this.session = session || null;
      if (this.session) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.session));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    },

    normalizeSession(payload) {
      if (!payload?.access_token || !payload?.user) return null;
      const expiresAt = payload.expires_at || Math.floor(Date.now() / 1000) + Number(payload.expires_in || 3600);
      return { ...payload, expires_at: expiresAt };
    },

    async authRequest(path, body, accessToken = '') {
      const { url, anonKey } = this.getConfig();
      const headers = {
        apikey: anonKey,
        'Content-Type': 'application/json'
      };

      // Supabase publishable keys are API keys, not JWTs.
      // Only send Authorization when we actually have a signed-in user's access token.
      if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
      }

      const response = await fetch(`${url}/auth/v1/${path}`, {
        method: 'POST',
        headers,
        body: body ? JSON.stringify(body) : undefined
      });

      let payload = null;
      try { payload = await response.json(); } catch (_) {}

      if (!response.ok) {
        throw new Error(payload?.msg || payload?.message || payload?.error_description || `Authentication failed (${response.status})`);
      }
      return payload;
    },

    async signIn(email, password) {
      const cleanEmail = String(email || '').trim();
      if (!cleanEmail || !password) throw new Error('Email and password are required.');

      const payload = await this.authRequest('token?grant_type=password', {
        email: cleanEmail,
        password: String(password)
      });

      const session = this.normalizeSession(payload);
      if (!session) throw new Error('Supabase returned an invalid authentication session.');
      this.persist(session);
      return session;
    },

    async refresh() {
      const refreshToken = this.session?.refresh_token;
      if (!refreshToken) return null;

      const payload = await this.authRequest('token?grant_type=refresh_token', {
        refresh_token: refreshToken
      });
      const session = this.normalizeSession(payload);
      if (!session) throw new Error('Unable to refresh authentication session.');
      this.persist(session);
      return session;
    },

    async ensureFreshSession() {
      if (!this.isAuthenticated()) return null;
      if (!this.isExpiringSoon()) return this.session;

      try {
        return await this.refresh();
      } catch (err) {
        console.warn('Supabase session refresh failed:', err);
        this.persist(null);
        return null;
      }
    },

    async fetchMappedAccount() {
      if (!this.isAuthenticated()) return null;
      await this.ensureFreshSession();

      const userId = this.getUser()?.id;
      if (!userId) return null;

      const { url, anonKey } = this.getConfig();
      const response = await fetch(
        `${url}/rest/v1/sub_accounts?select=*&auth_user_id=eq.${encodeURIComponent(userId)}&limit=1`,
        {
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${this.getAccessToken()}`,
            Accept: 'application/json'
          },
          cache: 'no-store'
        }
      );

      if (!response.ok) {
        throw new Error(`Account authorization check failed (${response.status})`);
      }

      const rows = await response.json();
      return Array.isArray(rows) ? rows[0] || null : null;
    },

    async bindLocalAccount() {
      const mapped = await this.fetchMappedAccount();
      if (!mapped || !window.Accounts) return null;

      const idx = window.Accounts.accounts.findIndex(account => account.id === mapped.id);
      if (idx >= 0) {
        window.Accounts.accounts[idx] = { ...window.Accounts.accounts[idx], ...mapped, pin: '' };
      } else {
        window.Accounts.accounts.push({ ...mapped, pin: '' });
      }

      window.Accounts.persist();
      window.Accounts.switchAccount(mapped.id);
      window.App?.updateAccountUI?.();
      return window.Accounts.getAccount(mapped.id);
    },

    async signOut() {
      const token = this.getAccessToken();
      if (token) {
        try {
          await this.authRequest('logout', null, token);
        } catch (err) {
          console.warn('Remote sign-out failed:', err);
        }
      }

      this.persist(null);
      window.DataLoader?.clearSensitiveCache?.();
      window.MASTER_SESSIONS = [];
      return true;
    }
  };

  SupabaseAuth.init();
  window.SupabaseAuth = SupabaseAuth;
})(window);
