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
      const savedConfig = typeof localStorage !== 'undefined' ? localStorage.getItem('fyc_supabase_config') : null;
      if (savedConfig) {
        try {
          const parsed = JSON.parse(savedConfig);
          this.url = (parsed.url || '').trim().replace(/\/$/, '');
          this.anonKey = (parsed.anonKey || '').trim();
          this.isConnected = !!(this.url && this.anonKey);
          this.lastCloudSync = localStorage.getItem('fyc_supabase_last_sync') || null;
          if (this.isConnected) this.syncDown(false);
        } catch (err) {
          console.warn('Invalid Supabase configuration:', err);
        }
      }
    },

    saveConfig(url, anonKey) {
      this.url = (url || '').trim().replace(/\/$/, '');
      this.anonKey = (anonKey || '').trim();
      this.isConnected = !!(this.url && this.anonKey);

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
      return {
        apikey: this.anonKey,
        Authorization: `Bearer ${this.anonKey}`,
        'Content-Type': 'application/json',
        Prefer: prefer
      };
    },

    async request(path, options = {}) {
      if (!this.url || !this.anonKey) throw new Error('Supabase is not configured.');

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

    async syncDown(showToasts = true) {
      if (!this.isConnected) return false;

      try {
        const [accounts, assessments, ratesList] = await Promise.all([
          this.request('sub_accounts?select=*'),
          this.request('host_assessments?select=*'),
          this.request('host_rates?select=*')
        ]);

        if (Array.isArray(accounts) && accounts.length && window.Accounts) {
          window.Accounts.accounts = accounts;
          localStorage.setItem('fyc_sub_accounts', JSON.stringify(accounts));

          const migrated = await window.Accounts.migrateLegacyPins();
          if (migrated) {
            await Promise.all(window.Accounts.getAccounts().map(account => this.saveAccount(account)));
          }
        }

        if (Array.isArray(assessments) && assessments.length && window.Scoring) {
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

        if (window.App?.renderCurrentView) {
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
