/**
 * Livestream Performance Intelligence Platform
 * Supabase Cloud Synchronization Engine (REST / PostgREST)
 * Zero external dependencies - pure modern fetch
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
          if (this.url && this.anonKey) {
            this.isConnected = true;
            this.lastCloudSync = localStorage.getItem('fyc_supabase_last_sync') || null;
            // Background sync on boot if configured
            this.syncDown(false);
          }
        } catch (e) {}
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
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('fyc_supabase_config');
        localStorage.removeItem('fyc_supabase_last_sync');
      }
    },

    getHeaders() {
      return {
        'apikey': this.anonKey,
        'Authorization': `Bearer ${this.anonKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      };
    },

    async testConnection() {
      if (!this.url || !this.anonKey) {
        return { success: false, message: 'Project URL and Anon Key must not be empty.' };
      }

      try {
        const res = await fetch(`${this.url}/rest/v1/sub_accounts?select=count`, {
          method: 'HEAD',
          headers: this.getHeaders()
        });

        if (res.ok) {
          this.isConnected = true;
          return { success: true, message: 'Connected to Supabase PostgreSQL database successfully!' };
        } else if (res.status === 404 || res.status === 400) {
          return {
            success: false,
            message: 'Supabase reached, but tables not found. Please run the SQL schema script in Supabase SQL Editor.'
          };
        } else {
          return { success: false, message: `Supabase returned status code ${res.status}: ${res.statusText}` };
        }
      } catch (err) {
        return { success: false, message: `Network connection error: ${err.message}` };
      }
    },

    // Pull cloud data from Supabase down into local app
    async syncDown(showToasts = true) {
      if (!this.isConnected) return false;

      try {
        // 1. Fetch Sub-Accounts
        const accRes = await fetch(`${this.url}/rest/v1/sub_accounts?select=*`, { headers: this.getHeaders() });
        if (accRes.ok) {
          const accounts = await accRes.json();
          if (Array.isArray(accounts) && accounts.length > 0) {
            window.Accounts.accounts = accounts;
            localStorage.setItem('fyc_sub_accounts', JSON.stringify(accounts));
          }
        }

        // 2. Fetch Assessments
        const assessRes = await fetch(`${this.url}/rest/v1/host_assessments?select=*`, { headers: this.getHeaders() });
        if (assessRes.ok) {
          const assessments = await assessRes.json();
          if (Array.isArray(assessments) && assessments.length > 0) {
            window.Scoring.assessments = assessments;
            localStorage.setItem('fyc_assessments', JSON.stringify(assessments));
          }
        }

        // 3. Fetch Host Rates
        const ratesRes = await fetch(`${this.url}/rest/v1/host_rates?select=*`, { headers: this.getHeaders() });
        if (ratesRes.ok) {
          const ratesList = await ratesRes.json();
          if (Array.isArray(ratesList) && ratesList.length > 0) {
            ratesList.forEach(r => {
              window.Payroll.rates[r.host_name] = parseInt(r.rate, 10);
            });
            localStorage.setItem('fyc_host_rates', JSON.stringify(window.Payroll.rates));
          }
        }

        const timeStr = new Date().toLocaleDateString('id-ID') + ' ' + new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        this.lastCloudSync = timeStr;
        localStorage.setItem('fyc_supabase_last_sync', timeStr);

        if (window.App && typeof window.App.renderCurrentView === 'function') {
          window.App.updateAccountUI();
          window.App.renderCurrentView();
        }

        return true;
      } catch (err) {
        console.warn('Supabase syncDown background error:', err);
        return false;
      }
    },

    // Push local state up to Supabase
    async syncUp() {
      if (!this.isConnected) return { success: false, message: 'Supabase is not configured.' };

      try {
        const headers = { ...this.getHeaders(), 'Prefer': 'resolution=merge-duplicates' };

        // 1. Push Accounts
        const accounts = window.Accounts.getAccounts();
        await fetch(`${this.url}/rest/v1/sub_accounts`, {
          method: 'POST',
          headers,
          body: JSON.stringify(accounts)
        });

        // 2. Push Assessments
        const assessments = window.Scoring.assessments;
        await fetch(`${this.url}/rest/v1/host_assessments`, {
          method: 'POST',
          headers,
          body: JSON.stringify(assessments)
        });

        // 3. Push Rates
        const ratesList = Object.entries(window.Payroll.rates).map(([host_name, rate]) => ({
          host_name,
          rate: parseInt(rate, 10),
          updated_at: new Date().toISOString()
        }));
        await fetch(`${this.url}/rest/v1/host_rates`, {
          method: 'POST',
          headers,
          body: JSON.stringify(ratesList)
        });

        const timeStr = new Date().toLocaleDateString('id-ID') + ' ' + new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        this.lastCloudSync = timeStr;
        localStorage.setItem('fyc_supabase_last_sync', timeStr);

        return { success: true, message: 'All local data uploaded to Supabase cloud successfully!' };
      } catch (err) {
        return { success: false, message: `Upload error: ${err.message}` };
      }
    },

    // Granular real-time mutations
    async saveAssessment(review) {
      if (!this.isConnected) return;
      try {
        await fetch(`${this.url}/rest/v1/host_assessments`, {
          method: 'POST',
          headers: { ...this.getHeaders(), 'Prefer': 'resolution=merge-duplicates' },
          body: JSON.stringify(review)
        });
      } catch (e) {}
    },

    async deleteAssessment(id) {
      if (!this.isConnected) return;
      try {
        await fetch(`${this.url}/rest/v1/host_assessments?id=eq.${encodeURIComponent(id)}`, {
          method: 'DELETE',
          headers: this.getHeaders()
        });
      } catch (e) {}
    },

    async saveAccount(account) {
      if (!this.isConnected) return;
      try {
        await fetch(`${this.url}/rest/v1/sub_accounts`, {
          method: 'POST',
          headers: { ...this.getHeaders(), 'Prefer': 'resolution=merge-duplicates' },
          body: JSON.stringify(account)
        });
      } catch (e) {}
    },

    async deleteAccount(id) {
      if (!this.isConnected) return;
      try {
        await fetch(`${this.url}/rest/v1/sub_accounts?id=eq.${encodeURIComponent(id)}`, {
          method: 'DELETE',
          headers: this.getHeaders()
        });
      } catch (e) {}
    },

    async saveHostRate(hostName, rate) {
      if (!this.isConnected) return;
      try {
        await fetch(`${this.url}/rest/v1/host_rates`, {
          method: 'POST',
          headers: { ...this.getHeaders(), 'Prefer': 'resolution=merge-duplicates' },
          body: JSON.stringify({ host_name: hostName, rate: parseInt(rate, 10), updated_at: new Date().toISOString() })
        });
      } catch (e) {}
    },

    // Ready-to-copy SQL Schema for user
    getSQLSchemaScript() {
      return `-- =======================================================
-- FYC Livestream Intelligence Platform - Supabase Database Schema
-- Run this in Supabase Dashboard > SQL Editor > New Query > Run
-- =======================================================

-- 1. Table: Sub-Accounts & Reviewers
CREATE TABLE IF NOT EXISTS public.sub_accounts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    "roleType" TEXT DEFAULT 'evaluator',
    pin TEXT DEFAULT '1234',
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

-- 2. Table: Host Assessments & Evaluations
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

-- 3. Table: Host Hourly Rate Cards
CREATE TABLE IF NOT EXISTS public.host_rates (
    host_name TEXT PRIMARY KEY,
    rate INTEGER NOT NULL DEFAULT 65000,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Enable Row Level Security (RLS) with Public Anon Access
ALTER TABLE public.sub_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.host_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.host_rates ENABLE ROW LEVEL SECURITY;

-- Allow read/write for authenticated & anon keys (internal agency use)
CREATE POLICY "Allow public anon access for sub_accounts" 
ON public.sub_accounts FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow public anon access for host_assessments" 
ON public.host_assessments FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow public anon access for host_rates" 
ON public.host_rates FOR ALL USING (true) WITH CHECK (true);
`;
    }
  };

  SupabaseEngine.init();
  window.SupabaseEngine = SupabaseEngine;
})(window);
