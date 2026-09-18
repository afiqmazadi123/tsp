/**
 * Supabase Cloud Synchronization Engine (REST / PostgREST)
 * Dependency-free and defensive: every cloud write checks the HTTP response.
 */

(function(window) {
  'use strict';

  const SupabaseEngine = {
    url: '',
    anonKey: '',
    isConnected: false,
    lastCloudSync: null,

    init() {
      const DEFAULT_CONFIG = {
        url: 'https://htckrzrpukospxokkgvd.supabase.co',
        anonKey: 'sb_publishable__ZXAk3Mj4U6zWwjQqIuvsg_JZrLbiQT'
      };

      this.url = DEFAULT_CONFIG.url;
      this.anonKey = DEFAULT_CONFIG.anonKey;
      this.isConnected = true;
      this.lastCloudSync = typeof localStorage !== 'undefined'
        ? localStorage.getItem('fyc_supabase_last_sync') || null
        : null;

      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('fyc_supabase_config', JSON.stringify(DEFAULT_CONFIG));
      }
    },

    saveConfig() {
      // Production Supabase endpoint is intentionally fixed.
      this.url = 'https://htckrzrpukospxokkgvd.supabase.co';
      this.anonKey = 'sb_publishable__ZXAk3Mj4U6zWwjQqIuvsg_JZrLbiQT';
      this.isConnected = true;
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('fyc_supabase_config', JSON.stringify({
          url: this.url,
          anonKey: this.anonKey
        }));
      }
    },

    disconnect() {
      this.url = '';
      this.anonKey = '';
      this.isConnected = false;
      this.lastCloudSync = null;
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('fyc_supabase_config');
        localStorage.removeItem('fyc_supabase_last_sync');
      }
    },

    getHeaders(prefer = 'return=representation') {
      const headers = {
        apikey: this.anonKey,
        'Content-Type': 'application/json',
        Prefer: prefer
      };
      const accessToken = window.SupabaseAuth?.getAccessToken?.();
      if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
      return headers;
    },

    async request(path, options = {}) {
      if (!this.url || !this.anonKey) throw new Error('Supabase is not configured.');

      if (window.SupabaseAuth?.isAuthenticated?.()) {
        await window.SupabaseAuth.ensureFreshSession();
      }

      const response = await fetch(`${this.url}/rest/v1/${path}`, {
        ...options,
        headers: {
          ...this.getHeaders(options.prefer),
          ...(options.headers || {})
        }
      });

      if (!response.ok) {
        let detail = '';
        try {
          const body = await response.json();
          detail = body.message || body.details || body.hint || '';
        } catch (_) {}

        throw new Error(`Supabase ${response.status} ${response.statusText}${detail ? ': ' + detail : ''}`);
      }

      if (options.method === 'HEAD' || response.status === 204) return null;
      const type = response.headers.get('content-type') || '';
      return type.includes('application/json') ? response.json() : response.text();
    },

    async invokeFunction(name, payload = {}) {
      if (!this.url || !this.anonKey) throw new Error('Supabase is not configured.');
      const accessToken = window.SupabaseAuth?.getAccessToken?.();
      if (!accessToken) throw new Error('Authentication required.');

      const response = await fetch(`${this.url}/functions/v1/${encodeURIComponent(name)}`, {
        method: 'POST',
        headers: {
          apikey: this.anonKey,
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      let body = null;
      try { body = await response.json(); } catch (_) {}

      if (!response.ok) {
        throw new Error(body?.error || body?.message || `Secure action failed (${response.status})`);
      }
      return body || {};
    },

    async testConnection() {
      if (!this.url || !this.anonKey) {
        return { success: false, message: 'Project URL and Anon Key must not be empty.' };
      }

      try {
        await this.request('sub_accounts?select=id&limit=1');
        this.isConnected = true;
        return { success: true, message: 'Connected to Supabase successfully.' };
      } catch (err) {
        return { success: false, message: err.message };
      }
    },

    stampSyncTime() {
      const now = new Date();
      const timeStr = now.toLocaleDateString('id-ID') + ' ' + now.toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit'
      });
      this.lastCloudSync = timeStr;
      localStorage.setItem('fyc_supabase_last_sync', timeStr);
      return timeStr;
    },

    async syncDown(showToasts = true, render = true) {
      if (!this.isConnected) return false;

      try {
        const [accounts, assessments, ratesList] = await Promise.all([
          this.request('sub_accounts?select=*'),
          this.request('host_assessments?select=*'),
          this.request('host_rates?select=*')
        ]);

        if (Array.isArray(accounts) && window.Accounts) {
          const secureMode = !!window.SupabaseAuth?.isAuthenticated?.();
          const visibleAccounts = secureMode
            ? accounts.filter(account => !!account.auth_user_id)
            : accounts;

          window.Accounts.accounts = visibleAccounts;
          localStorage.setItem('fyc_sub_accounts', JSON.stringify(visibleAccounts));

          if (!secureMode) {
            const migrated = await window.Accounts.migrateLegacyPins();
            if (migrated) {
              await Promise.all(window.Accounts.getAccounts().map(account => this.saveAccount(account)));
            }
          }

          await window.SupabaseAuth?.bindLocalAccount?.();
        }

        if (Array.isArray(assessments) && window.Scoring) {
          window.Scoring.assessments = assessments;
          localStorage.setItem('fyc_assessments', JSON.stringify(assessments));
        }

        if (Array.isArray(ratesList) && ratesList.length && window.Payroll) {
          ratesList.forEach(row => {
            window.Payroll.rates[row.host_name] = Number.parseInt(row.rate, 10) || 0;
          });
          localStorage.setItem('fyc_host_rates', JSON.stringify(window.Payroll.rates));
        }

        this.stampSyncTime();
        window.AppStore?.invalidate();

        if (render && window.App?.renderCurrentView) {
          window.App.updateAccountUI?.();
          window.App.renderCurrentView();
        }

        return true;
      } catch (err) {
        console.warn('Supabase sync failed:', err);
        if (showToasts) window.UI?.toast?.('Cloud sync failed: ' + err.message, 'error');
        return false;
      }
    },

    async syncUp() {
      if (!this.isConnected) {
        return { success: false, message: 'Supabase is not configured.' };
      }

      try {
        const accounts = window.Accounts?.getAccounts?.() || [];
        const assessments = window.Scoring?.assessments || [];
        const rates = window.Payroll?.rates || {};

        await this.request('sub_accounts?on_conflict=id', {
          method: 'POST',
          prefer: 'resolution=merge-duplicates,return=minimal',
          body: JSON.stringify(accounts)
        });

        if (assessments.length) {
          await this.request('host_assessments?on_conflict=id', {
            method: 'POST',
            prefer: 'resolution=merge-duplicates,return=minimal',
            body: JSON.stringify(assessments)
          });
        }

        const ratesList = Object.entries(rates).map(([host_name, rate]) => ({
          host_name,
          rate: Number.parseInt(rate, 10) || 0,
          updated_at: new Date().toISOString()
        }));

        if (ratesList.length) {
          await this.request('host_rates?on_conflict=host_name', {
            method: 'POST',
            prefer: 'resolution=merge-duplicates,return=minimal',
            body: JSON.stringify(ratesList)
          });
        }

        this.stampSyncTime();
        return { success: true, message: 'Local data uploaded to Supabase successfully.' };
      } catch (err) {
        return { success: false, message: 'Upload failed: ' + err.message };
      }
    },

    async saveAssessment(review) {
      if (!this.isConnected || !review) return false;
      try {
        await this.request('host_assessments?on_conflict=id', {
          method: 'POST',
          prefer: 'resolution=merge-duplicates,return=minimal',
          body: JSON.stringify(review)
        });
        return true;
      } catch (err) {
        console.warn('Assessment cloud save failed:', err);
        return false;
      }
    },

    async deleteAssessment(id) {
      if (!this.isConnected || !id) return false;
      try {
        await this.request(`host_assessments?id=eq.${encodeURIComponent(id)}`, {
          method: 'DELETE',
          prefer: 'return=minimal'
        });
        return true;
      } catch (err) {
        console.warn('Assessment cloud delete failed:', err);
        return false;
      }
    },

    async saveAccount(account) {
      if (!this.isConnected || !account) return false;
      try {
        await this.request('sub_accounts?on_conflict=id', {
          method: 'POST',
          prefer: 'resolution=merge-duplicates,return=minimal',
          body: JSON.stringify(account)
        });
        return true;
      } catch (err) {
        console.warn('Account cloud save failed:', err);
        return false;
      }
    },

    async deleteAccount(id) {
      if (!this.isConnected || !id) return false;
      try {
        await this.request(`sub_accounts?id=eq.${encodeURIComponent(id)}`, {
          method: 'DELETE',
          prefer: 'return=minimal'
        });
        return true;
      } catch (err) {
        console.warn('Account cloud delete failed:', err);
        return false;
      }
    },

    async saveHostRate(hostName, rate) {
      if (!this.isConnected || !hostName) return false;
      try {
        await this.request('host_rates?on_conflict=host_name', {
          method: 'POST',
          prefer: 'resolution=merge-duplicates,return=minimal',
          body: JSON.stringify({
            host_name: hostName,
            rate: Number.parseInt(rate, 10) || 0,
            updated_at: new Date().toISOString()
          })
        });
        return true;
      } catch (err) {
        console.warn('Host rate cloud save failed:', err);
        return false;
      }
    },

    async upsertLivestreamSessions(sessions) {
      if (!this.isConnected) throw new Error('Supabase is not connected.');
      if (!window.SupabaseAuth?.isAuthenticated?.()) throw new Error('Authentication required.');
      if (!Array.isArray(sessions) || !sessions.length) throw new Error('No session rows to upload.');

      const clean = sessions.map(row => ({
        id: String(row.id || ''),
        date: row.date,
        brand: String(row.brand || ''),
        start: String(row.start || ''),
        end: String(row.end || ''),
        duration: Number(row.duration || 0),
        platform: String(row.platform || ''),
        host: String(row.host || ''),
        gmv: Number(row.gmv || 0),
        gmv_hr: Number(row.gmv_hr || 0),
        product: String(row.product || ''),
        ctr: Number(row.ctr || 0),
        ctor: Number(row.ctor || 0),
        ads_cost: Number(row.ads_cost || 0),
        views: Number(row.views || 0),
        followers: Number(row.followers || 0),
        sold_qty: Number(row.sold_qty || 0),
        buyer: Number(row.buyer || 0),
        updated_at: new Date().toISOString()
      }));

      for (let i = 0; i < clean.length; i += 250) {
        await this.request('livestream_sessions?on_conflict=id', {
          method: 'POST',
          prefer: 'resolution=merge-duplicates,return=minimal',
          body: JSON.stringify(clean.slice(i, i + 250))
        });
      }

      return { success: true, count: clean.length };
    },

    getSQLSchemaScript() {
      return `-- =======================================================
-- FYC Live Ops - Supabase schema
-- NOTE: The policies below preserve the current client-only sync model.
-- They are convenient, but they are NOT a strong authorization boundary.
-- For production-grade security, use Supabase Auth + authenticated-only RLS.
-- =======================================================

CREATE TABLE IF NOT EXISTS public.sub_accounts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    "roleType" TEXT DEFAULT 'evaluator',
    pin TEXT DEFAULT '',
    "avatarColor" TEXT DEFAULT '#0071e3',
    initials TEXT,
    "canGrade" BOOLEAN DEFAULT true,
    "canManageRates" BOOLEAN DEFAULT false,
    "canManageAccounts" BOOLEAN DEFAULT false,
    "canApprovePayroll" BOOLEAN DEFAULT false,
    "canEditWeights" BOOLEAN DEFAULT false,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.host_assessments (
    id TEXT PRIMARY KEY,
    host TEXT NOT NULL,
    reviewer TEXT NOT NULL,
    cta NUMERIC(3,1) DEFAULT 4.0,
    pin NUMERIC(3,1) DEFAULT 4.0,
    discipline NUMERIC(3,1) DEFAULT 4.0,
    grooming NUMERIC(3,1) DEFAULT 4.0,
    notes TEXT,
    date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.host_rates (
    host_name TEXT PRIMARY KEY,
    rate INTEGER NOT NULL DEFAULT 65000,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.sub_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.host_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.host_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public anon access for sub_accounts" ON public.sub_accounts;
DROP POLICY IF EXISTS "Allow public anon access for host_assessments" ON public.host_assessments;
DROP POLICY IF EXISTS "Allow public anon access for host_rates" ON public.host_rates;

CREATE POLICY "Allow public anon access for sub_accounts"
ON public.sub_accounts FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Allow public anon access for host_assessments"
ON public.host_assessments FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Allow public anon access for host_rates"
ON public.host_rates FOR ALL TO anon USING (true) WITH CHECK (true);
`;
    }
  };

  SupabaseEngine.init();
  window.SupabaseEngine = SupabaseEngine;
})(window);
