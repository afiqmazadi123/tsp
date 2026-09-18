/**
 * Extracted from app.js — admin and settings views
 */
(function(window) {
  'use strict';
  const App = window.App;
  if (!App) return;

  Object.assign(App, {
    // 8. ADMIN MANAGEMENT VIEW (RATES & SUB-ACCOUNTS)
    renderAdminView(container, data) {
      const { scoredHosts } = data;
      const currentAcc = Accounts.getCurrentAccount();
      const accounts = Accounts.getAccounts();
      const hostRates = Payroll.getAllHostRates();

      container.innerHTML = `
        <div class="view-header">
          <div>
            <h2 class="view-title">Admin Control Panel</h2>
            <p class="view-subtitle">Manage creator hourly rates, sub-accounts, passwords/PINs, and cloud data portability</p>
          </div>
          <div class="action-row">
            <button class="apple-btn apple-btn-secondary" data-app-action="exportFullBackupJSON">Download Data Backup</button>
            <button class="apple-btn apple-btn-primary" data-app-action="openAddAccountModal">+ New Sub-Account</button>
          </div>
        </div>

        <!-- Admin Navigation Tabs -->
        <div class="admin-tabs">
          <button class="admin-tab-btn ${this.adminActiveTab === 'host-rates' ? 'active' : ''}" data-app-action="setAdminTab" data-app-arg="host-rates">Host Rate Cards (${hostRates.length})</button>
          <button class="admin-tab-btn ${this.adminActiveTab === 'sub-accounts' ? 'active' : ''}" data-app-action="setAdminTab" data-app-arg="sub-accounts">Sub-Accounts & PINs (${accounts.length})</button>
          <button class="admin-tab-btn ${this.adminActiveTab === 'cloud-sync' ? 'active' : ''}" data-app-action="setAdminTab" data-app-arg="cloud-sync">Cloud & Storage Info</button>
        </div>

        <div id="admin-tab-content">
          ${this.adminActiveTab === 'host-rates' ? this.renderAdminHostRates(hostRates, scoredHosts) : ''}
          ${this.adminActiveTab === 'sub-accounts' ? this.renderAdminSubAccounts(accounts) : ''}
          ${this.adminActiveTab === 'cloud-sync' ? this.renderAdminCloudSync() : ''}
        </div>
      `;
    },

    setAdminTab(tabName) {
      this.adminActiveTab = tabName;
      this.renderCurrentView();
    },

    renderAdminHostRates(hostRates, scoredHosts) {
      return `
        <div class="glass-card">
          <div class="card-header">
            <div class="card-title-group">
              <h3>Creator Hourly Rate Card Master</h3>
              <p>Configure base rates per hour. Rate adjustments automatically track audit timestamps and reason logs.</p>
            </div>
          </div>

          <div class="table-responsive">
            <table class="apple-table" data-sortable="true">
              <thead>
                <tr>
                  <th>Host</th>
                  <th>Level / Role</th>
                  <th>Current Rate / Hour</th>
                  <th>Total Hours</th>
                  <th>Total GMV</th>
                  <th>Rate History</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                ${hostRates.map(h => {
                  const stat = scoredHosts.find(s => s.name.toLowerCase() === h.name.toLowerCase()) || { duration: 0, gmv: 0 };
                  return `
                    <tr>
                      <td>
                        <div class="inline-group">
                          <div class="user-avatar" style="background:${h.avatarColor || '#0071e3'};width:28px;height:28px;font-size:11px;">
                            ${h.name.substring(0, 2).toUpperCase()}
                          </div>
                          <strong>${h.name}</strong>
                        </div>
                      </td>
                      <td>
                        <span class="tier-badge" style="background:rgba(255,255,255,0.08);color:var(--text-secondary)">${h.tier}</span>
                        <div style="font-size:10.5px;color:var(--text-tertiary);margin-top:2px;">${h.role || ''}</div>
                      </td>
                      <td>
                        <span style="font-size:14px;font-weight:700;color:var(--apple-green)">${AppleCharts.formatIDR(h.rate)}</span>/hr
                      </td>
                      <td>${stat.duration.toFixed(0)} hrs</td>
                      <td style="color:var(--apple-cyan);font-weight:600">${AppleCharts.formatIDRShort(stat.gmv)}</td>
                      <td>
                        <span style="font-size:11px;color:var(--text-tertiary);">${h.history.length} adjustments</span>
                      </td>
                      <td>
                        <button class="apple-btn apple-btn-secondary compact-btn" data-app-action="openAdjustRateModal" data-app-arg="${h.name}">
                          ✏️ Adjust Rate
                        </button>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    },

    renderAdminSubAccounts(accounts) {
      return `
        <div class="glass-card">
          <div class="card-header">
            <div class="card-title-group">
              <h3>Sub-Accounts & Authentication Security</h3>
              <p>Manage team evaluator credentials, PIN passwords, and administrative access rights</p>
            </div>
            <button class="apple-btn apple-btn-primary" data-app-action="openAddAccountModal">+ Add Sub-Account</button>
          </div>

          <div class="table-responsive">
            <table class="apple-table" data-sortable="true">
              <thead>
                <tr>
                  <th>User / Evaluator</th>
                  <th>Role & Title</th>
                  <th>Security PIN</th>
                  <th>Permissions</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${accounts.map(acc => `
                  <tr>
                    <td>
                      <div class="inline-group">
                        <div class="user-avatar" style="background:${acc.avatarColor || '#0071e3'};width:32px;height:32px;font-size:12px;">
                          ${acc.initials}
                        </div>
                        <div>
                          <strong>${acc.name}</strong>
                          <div class="helper-text">${acc.description || ''}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span class="tier-badge" style="background:rgba(0,113,227,0.15);color:var(--apple-cyan)">${acc.role}</span>
                    </td>
                    <td>
                      <span class="pin-display-mask">${Accounts.hasPin(acc) ? 'Protected' : 'No PIN'}</span>
                    </td>
                    <td>
                      <div style="display:flex;gap:4px;flex-wrap:wrap;">
                        ${acc.canGrade ? '<span class="tier-badge" style="background:rgba(48,209,88,0.15);color:var(--apple-green)">Evaluator</span>' : ''}
                        ${acc.canManageRates ? '<span class="tier-badge" style="background:rgba(255,159,10,0.15);color:var(--apple-orange)">Rates</span>' : ''}
                        ${acc.canApprovePayroll ? '<span class="tier-badge" style="background:rgba(191,90,242,0.15);color:var(--apple-purple)">Payroll</span>' : ''}
                        ${acc.canManageAccounts ? '<span class="tier-badge" style="background:rgba(41,151,255,0.15);color:var(--apple-cyan)">Admin</span>' : ''}
                      </div>
                    </td>
                    <td>
                      <div style="display:flex;gap:6px;">
                        <button class="apple-btn apple-btn-secondary compact-btn" data-app-action="openEditAccountModal" data-app-arg="${acc.id}">
                          ✏️ Edit
                        </button>
                        ${acc.id !== 'acc_afiq' ? `
                          <button class="review-action-btn delete" data-app-action="deleteAccount" data-app-arg="${acc.id}" title="Delete Account">
                            🗑️
                          </button>
                        ` : ''}
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    },

    togglePinVisibility(accId, realPin) {
      const el = document.getElementById(`pin-mask-${accId}`);
      if (!el) return;
      if (el.textContent === '••••') {
        el.textContent = realPin;
      } else {
        el.textContent = '••••';
      }
    },

        renderAdminCloudSync() {
      const isConnected = window.SupabaseEngine && window.SupabaseEngine.isConnected;
      const lastSync = window.SupabaseEngine ? (window.SupabaseEngine.lastCloudSync || 'Never') : 'Never';
      const sqlSchema = window.SupabaseEngine ? window.SupabaseEngine.getSQLSchemaScript() : '';
      const authUser = window.SupabaseAuth?.getUser?.() || null;
      const authActive = !!window.SupabaseAuth?.isAuthenticated?.();

      return `
        <div style="display:flex;flex-direction:column;gap:20px;max-width:900px;">
          <!-- Supabase Live Connection Card -->
          <div class="glass-card">
            <div class="card-header">
              <div class="card-title-group">
                <h3>⚡ Supabase Cloud Database Integration</h3>
                <p>Connect your free Supabase PostgreSQL database to sync sub-accounts, assessments, and rates across all team laptops</p>
              </div>
              <div>
                ${isConnected ? 
                  '<span class="delta-badge positive" style="font-size:11.5px;padding:4px 10px;">● Cloud Sync Active</span>' : 
                  '<span class="delta-badge neutral" style="font-size:11.5px;padding:4px 10px;">○ LocalStorage Mode</span>'}
              </div>
            </div>

            <div class="form-stack">
              <div>
                <label class="form-label">Supabase Project URL</label>
                <input type="text" id="supabase-url" value="${window.SupabaseEngine.url || ''}" placeholder="https://your-project-ref.supabase.co" class="select-filter full-width code-input" />
                <span style="font-size:11px;color:var(--text-tertiary);margin-top:3px;display:block;">Found in Supabase Dashboard > Project Settings > API > Project URL</span>
              </div>

              <div>
                <label class="form-label">Supabase Project API Key (anon public key)</label>
                <input type="password" id="supabase-anon-key" value="${window.SupabaseEngine.anonKey || ''}" placeholder="eyJhbGciOi..." class="select-filter full-width code-input" />
                <span style="font-size:11px;color:var(--text-tertiary);margin-top:3px;display:block;">Found in Supabase Dashboard > Project Settings > API > anon public key (safe for client apps)</span>
              </div>

              <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:8px;">
                <button class="apple-btn apple-btn-primary" data-app-action="connectSupabase">Save & Test Connection</button>
                ${isConnected ? `
                  <button class="apple-btn apple-btn-secondary" data-app-action="pullSupabaseData">⬇️ Pull Latest from Cloud</button>
                  <button class="apple-btn apple-btn-secondary" data-app-action="pushSupabaseData">⬆️ Push Local to Cloud</button>
                  <button class="apple-btn apple-btn-secondary" style="color:var(--apple-red)" data-app-action="disconnectSupabase">Disconnect</button>
                ` : ''}
              </div>

              ${isConnected ? `
                <div style="font-size:11.5px;color:var(--text-tertiary);margin-top:4px;">
                  Last synchronized with Supabase: <strong>${lastSync}</strong>
                </div>
              ` : ''}
            </div>
          </div>

          <!-- Optional Secure Authentication -->
          <div class="glass-card">
            <div class="card-header">
              <div class="card-title-group">
                <h3>Secure Supabase Auth</h3>
                <p>Optional production mode. Authenticated sessions use the user JWT for database requests.</p>
              </div>
              <span class="delta-badge ${authActive ? 'positive' : 'neutral'}">
                ${authActive ? '● Authenticated' : '○ Anon-compatible'}
              </span>
            </div>

            ${!isConnected ? `
              <p class="muted-copy">Connect the Supabase project above before signing in.</p>
            ` : authActive ? `
              <div class="auth-session-card">
                <div>
                  <span class="helper-text">Signed in as</span>
                  <strong>${authUser?.email || 'Supabase user'}</strong>
                  <span class="helper-text code-input">${authUser?.id || ''}</span>
                </div>
                <button class="apple-btn apple-btn-secondary" data-app-action="signOutSupabaseAuth">Sign out</button>
              </div>
            ` : `
              <div class="form-stack auth-login-form">
                <div class="form-grid-2">
                  <div>
                    <label class="form-label">Auth Email</label>
                    <input type="email" id="supabase-auth-email" class="select-filter full-width" autocomplete="username" placeholder="name@company.com" />
                  </div>
                  <div>
                    <label class="form-label">Password</label>
                    <input type="password" id="supabase-auth-password" class="select-filter full-width" autocomplete="current-password" placeholder="Supabase Auth password" />
                  </div>
                </div>
                <div class="auth-login-footer">
                  <span class="helper-text">Provision users in Supabase Auth and map their UUID to <code>sub_accounts.auth_user_id</code> before enabling secure RLS.</span>
                  <button class="apple-btn apple-btn-primary" data-app-action="signInSupabaseAuth">Sign in securely</button>
                </div>
              </div>
            `}
          </div>

          <!-- Setup SQL Schema Script -->
          <div class="glass-card">
            <div class="card-header">
              <div class="card-title-group">
                <h3>📋 1-Click Database Setup (SQL Schema)</h3>
                <p>Run this script once in Supabase (SQL Editor > New Query > Run) to create tables automatically</p>
              </div>
              <button class="apple-btn apple-btn-secondary" data-app-action="copySQLSchema">Copy SQL Script</button>
            </div>

            <div style="position:relative;">
              <pre style="background:rgba(0,0,0,0.5);border:1px solid var(--border-subtle);border-radius:var(--radius-sm);padding:14px;max-height:220px;overflow-y:auto;font-size:11px;color:var(--apple-cyan);font-family:monospace;line-height:1.4;"><code id="sql-schema-text">${sqlSchema}</code></pre>
            </div>
          </div>

          <!-- Local Backup & Portability -->
          <div class="glass-card">
            <div class="card-header">
              <div class="card-title-group">
                <h3>💾 Manual Data Backup & Migration</h3>
                <p>Export or restore all platform configuration, sub-accounts, and evaluations via JSON file</p>
              </div>
            </div>

            <div class="action-row">
              <button class="apple-btn apple-btn-secondary" data-app-action="exportFullBackupJSON">Download Complete Backup JSON</button>
              <button class="apple-btn apple-btn-secondary" data-app-action="openImportBackupModal">Restore Backup JSON</button>
            </div>
          </div>
        </div>
      `;
    },

    async signInSupabaseAuth() {
      const email = document.getElementById('supabase-auth-email')?.value.trim();
      const password = document.getElementById('supabase-auth-password')?.value || '';
      if (!email || !password) {
        window.UI?.toast?.('Enter the Supabase Auth email and password.', 'warning');
        return;
      }

      await window.UI.withBusy(async () => {
        const session = await window.SupabaseAuth.signIn(email, password);
        window.UI?.toast?.(`Signed in as ${session.user?.email || email}.`, 'success');
        await window.SupabaseEngine.syncDown(false);
        this.updateAccountUI();
        this.renderCurrentView();
      }, 'Signing in securely…');
    },

    async signOutSupabaseAuth() {
      await window.SupabaseAuth?.signOut?.();
      window.UI?.toast?.('Supabase Auth session signed out. Anon-compatible mode remains available.', 'success');
      this.renderCurrentView();
    },

    async connectSupabase() {
      const url = document.getElementById('supabase-url').value.trim();
      const key = document.getElementById('supabase-anon-key').value.trim();

      if (!url || !key) {
        window.UI?.toast?.('Please enter both Supabase Project URL and Anon Public Key.', 'warning');
        return;
      }

      window.SupabaseEngine.saveConfig(url, key);
      await window.UI.withBusy(async () => {
        const res = await window.SupabaseEngine.testConnection();
        if (res.success) {
          window.UI?.toast?.('Connected to Supabase. Pulling latest cloud data…', 'success');
          await window.SupabaseEngine.syncDown();
        } else {
          window.UI?.toast?.(res.message, 'error');
        }
        this.renderCurrentView();
      }, 'Connecting to Supabase…');
    },

    async pullSupabaseData() {
      await window.UI.withBusy(async () => {
        const ok = await window.SupabaseEngine.syncDown();
        if (ok) {
          window.UI?.toast?.('Latest cloud data pulled successfully.', 'success');
          this.renderCurrentView();
        } else {
          window.UI?.toast?.('Cloud pull failed. Check connection and API keys.', 'error');
        }
      }, 'Pulling cloud data…');
    },

    async pushSupabaseData() {
      await window.UI.withBusy(async () => {
        const res = await window.SupabaseEngine.syncUp();
        window.UI?.toast?.(res.message, res.success === false ? 'error' : 'success');
        this.renderCurrentView();
      }, 'Uploading local changes…');
    },

    async disconnectSupabase() {
      const confirmed = await window.UI?.confirm?.(
        'Disconnect Supabase and return this browser to local-only storage mode?',
        { title: 'Disconnect cloud sync', confirmLabel: 'Disconnect', danger: true }
      );
      if (!confirmed) return;

      window.SupabaseEngine.disconnect();
      window.UI?.toast?.('Disconnected from Supabase.', 'success');
      this.renderCurrentView();
    },

    copySQLSchema() {
      const sql = window.SupabaseEngine.getSQLSchemaScript();
      navigator.clipboard.writeText(sql).then(() => {
        window.UI?.toast?.('SQL schema copied to clipboard.', 'success');
      }).catch(() => {
        window.UI?.toast?.('Clipboard access failed. Copy the SQL manually.', 'warning');
      });
    },

    exportFullBackupJSON() {
      const backupData = {
        exportedAt: new Date().toISOString(),
        accounts: Accounts.getAccounts(),
        rates: Payroll.rates,
        rateHistory: Payroll.rateHistory,
        assessments: Scoring.assessments,
        scoringWeights: Scoring.weights,
        payrollStatus: Payroll.verificationStatus
      };

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fyc_intelligence_backup_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
    },

    openImportBackupModal() {
      const modal = document.getElementById('generic-modal');
      const container = document.getElementById('modal-inner-content');
      if (!modal || !container) return;

      container.innerHTML = `
        <h3 style="font-size:18px;font-weight:700;margin-bottom:8px;">Restore Platform Backup</h3>
        <p class="muted-copy">Upload a previously downloaded JSON backup file to restore sub-accounts and rates</p>
        <input type="file" id="backup-file-input" accept=".json" class="select-filter full-width" />
        <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:16px;">
          <button class="apple-btn apple-btn-secondary" data-app-action="closeModal">Cancel</button>
          <button class="apple-btn apple-btn-primary" id="btn-process-backup">Restore Data</button>
        </div>
      `;

      document.getElementById('btn-process-backup').onclick = () => {
        const fileInput = document.getElementById('backup-file-input');
        if (!fileInput.files || fileInput.files.length === 0) {
          window.UI?.toast?.('Choose a backup JSON file first.', 'warning');
          return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const data = JSON.parse(e.target.result);
            if (data.accounts) localStorage.setItem('fyc_sub_accounts', JSON.stringify(data.accounts));
            if (data.rates) localStorage.setItem('fyc_host_rates', JSON.stringify(data.rates));
            if (data.rateHistory) localStorage.setItem('fyc_rate_history', JSON.stringify(data.rateHistory));
            if (data.assessments) localStorage.setItem('fyc_assessments', JSON.stringify(data.assessments));
            if (data.scoringWeights) localStorage.setItem('fyc_scoring_weights', JSON.stringify(data.scoringWeights));

            window.UI?.toast?.('Backup restored. Reloading…', 'success');
            location.reload();
          } catch (err) {
            window.UI?.toast?.('Invalid backup JSON: ' + err.message, 'error');
          }
        };
        reader.readAsText(fileInput.files[0]);
      };

      modal.classList.add('active');
    },

    // 9. SETTINGS VIEW
    renderSettingsView(container) {
      container.innerHTML = `
        <div style="margin-bottom:8px;">
          <h2 class="view-title">Platform Settings & Data Connection</h2>
          <p class="view-subtitle">Manage master spreadsheet bindings, sync intervals, and sub-accounts</p>
        </div>

        <div class="glass-card" style="max-width:700px">
          <div class="card-header">
            <div class="card-title-group">
              <h3>Google Spreadsheet Master Connection</h3>
              <p>Configure Google Drive Sheet ID and Target Sheet Tab</p>
            </div>
          </div>

          <div style="display:flex;flex-direction:column;gap:16px;">
            <div>
              <label style="display:block;font-size:12px;color:var(--text-secondary);margin-bottom:6px">Google Sheet ID</label>
              <input type="text" id="setting-sheet-id" value="${SyncEngine.sheetId}" class="select-filter full-width code-input" />
            </div>
            <div>
              <label style="display:block;font-size:12px;color:var(--text-secondary);margin-bottom:6px">Target Sheet Name</label>
              <input type="text" id="setting-sheet-name" value="${SyncEngine.sheetName}" class="select-filter full-width" />
            </div>

            <div style="display:flex;gap:10px;margin-top:8px;">
              <button class="apple-btn apple-btn-primary" data-app-action="saveSheetSettings">Save Configuration</button>
              <button class="apple-btn apple-btn-secondary" data-app-action="triggerSync">Sync Now from Google Sheet</button>
            </div>

            <div style="padding:14px;background:rgba(255,255,255,0.03);border-radius:var(--radius-sm);border:1px solid var(--border-subtle);margin-top:12px;">
              <h4 style="font-size:13px;font-weight:600;margin-bottom:4px">Upload / Update via Drag & Drop</h4>
              <p style="font-size:12px;color:var(--text-tertiary);line-height:1.5">
                Whenever your Google Sheet updates, you can also download the "Report" tab as CSV and drag & drop it directly into the dashboard. It will instantly re-process all calculations.
              </p>
              <button class="apple-btn apple-btn-secondary" style="margin-top:10px;" data-app-action="openSyncModal">Open Drag & Drop Uploader</button>
            </div>
          </div>
        </div>
      `;
    },

    saveSheetSettings() {
      const id = document.getElementById('setting-sheet-id').value.trim();
      const name = document.getElementById('setting-sheet-name').value.trim();
      SyncEngine.saveConfig(id, name);
      window.UI?.toast?.('Google Sheet settings saved.', 'success');
    },

    async triggerSync() {
      await window.UI.withBusy(async () => {
        const res = await SyncEngine.syncFromGoogleSheet();
        if (res.success) {
          window.AppStore?.invalidate();
          window.UI?.toast?.(`Sync complete: ${res.count.toLocaleString('id-ID')} sessions updated.`, 'success');
          this.renderCurrentView();
        } else {
          window.UI?.toast?.(res.message, 'error');
        }
      }, 'Syncing Google Sheet…');
    },


  });
})(window);
