/**
 * Optional Supabase Auth runtime.
 * Backward compatible: the app continues to work in anon mode until a user signs in.
 */
(function(window) {
  'use strict';

  const STORAGE_KEY = 'fyc_supabase_auth_session';

  const SupabaseAuth = {
    session: null,
    ready: Promise.resolve(),

    init() {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed?.access_token && parsed?.user) this.session = parsed;
        }
      } catch (err) {
        console.warn('Unable to restore Supabase auth session:', err);
      }

      this.ready = this.ensureFreshSession();
      return this.ready;
    },

    getConfig() {
      try {
        const parsed = JSON.parse(localStorage.getItem('fyc_supabase_config') || '{}');
        return {
          url: String(parsed.url || '').replace(/\/$/, ''),
          anonKey: String(parsed.anonKey || '')
        };
      } catch (_) {
        return { url: '', anonKey: '' };
      }
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
      if (!url || !anonKey) throw new Error('Configure Supabase URL and anon key first.');

      const response = await fetch(`${url}/auth/v1/${path}`, {
        method: 'POST',
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${accessToken || anonKey}`,
          'Content-Type': 'application/json'
        },
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
      await this.bindLocalAccount();
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
      if (!this.isExpiringSoon()) {
        await this.bindLocalAccount();
        return this.session;
      }

      try {
        return await this.refresh();
      } catch (err) {
        console.warn('Supabase session refresh failed:', err);
        this.persist(null);
        return null;
      }
    },

    async signOut() {
      if (this.isAuthenticated()) {
        try {
          await this.authRequest('logout', null, this.getAccessToken());
        } catch (err) {
          console.warn('Remote sign-out failed:', err);
        }
      }
      this.persist(null);
      return true;
    },

    async bindLocalAccount() {
      const userId = this.getUser()?.id;
      if (!userId || !window.Accounts?.getAccounts) return null;

      const match = window.Accounts.getAccounts().find(account => account.auth_user_id === userId);
      if (match) {
        window.Accounts.switchAccount(match.id);
        window.App?.updateAccountUI?.();
      }
      return match || null;
    }
  };

  SupabaseAuth.init();
  window.SupabaseAuth = SupabaseAuth;
})(window);
