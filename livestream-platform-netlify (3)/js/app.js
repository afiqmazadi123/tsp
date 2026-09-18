/**
 * Livestream Performance Intelligence Platform
 * Main UI Controller & View Manager
 * Features: Apple Pro UI, Sub-Accounts (Evaluators, Admin, Finance), Full Edit/Update/Delete Assessments,
 * Start+End Date Range Picker, and Dedicated Admin Control Panel (Host Rates, Sub-Accounts, PIN/Passwords)
 */

(function(window) {
  'use strict';

  // Fallback for Accounts if accounts.js was blocked or failed
  if (typeof window.Accounts === 'undefined') {
    window.Accounts = {
      accounts: [
        { id: 'acc_afiq', name: 'Afiq Mazadi', role: 'Lead Live Operations', pin: '1234', initials: 'AM', avatarColor: '#0071e3', canGrade: true, canManageRates: true, canManageAccounts: true, canApprovePayroll: true, description: 'Super Admin' },
        { id: 'acc_harto', name: 'Ko Harto', role: 'Head of Livestreaming', pin: '1234', initials: 'KH', avatarColor: '#bf5af2', canGrade: true, canManageRates: true, canManageAccounts: true, canApprovePayroll: true, description: 'Executive Reviewer' },
        { id: 'acc_cici', name: 'Cici', role: 'Quality & Host Assessment Supervisor', pin: '1234', initials: 'CC', avatarColor: '#ff2d55', canGrade: true, canManageRates: false, canManageAccounts: false, canApprovePayroll: false, description: 'Lead Evaluator' },
        { id: 'acc_aimee', name: 'Aimee', role: 'Livestream Operations Evaluator', pin: '1234', initials: 'AI', avatarColor: '#30d158', canGrade: true, canManageRates: false, canManageAccounts: false, canApprovePayroll: false, description: 'Shift Evaluator' },
        { id: 'acc_finance', name: 'Finance Team', role: 'Payroll Specialist', pin: '1234', initials: 'FN', avatarColor: '#ff9f0a', canGrade: false, canManageRates: true, canManageAccounts: false, canApprovePayroll: true, description: 'Payroll Verifier' },
        { id: 'acc_brand', name: 'Brand Partner Guest', role: 'Brand Client View', pin: '', initials: 'BP', avatarColor: '#64d2ff', canGrade: false, canManageRates: false, canManageAccounts: false, canApprovePayroll: false, description: 'Pitch Mode Guest' }
      ],
      currentAccountId: 'acc_afiq',
      getCurrentAccount() { return this.getAccount(this.currentAccountId) || this.accounts[0]; },
      getAccounts() { return this.accounts; },
      getReviewerAccounts() { return this.accounts.filter(a => a.canGrade); },
      getAccount(id) { return this.accounts.find(a => a.id === id) || this.accounts[0]; },
      getAccountByName(name) { return this.accounts.find(a => a.name.toLowerCase() === name.toLowerCase()); },
      verifyPin(id, pin) { const a = this.getAccount(id); return !a.pin || a.pin === String(pin).trim(); },
      switchAccount(id) { this.currentAccountId = id; return this.getAccount(id); },
      addAccount(acc) {
        acc.id = 'acc_' + Date.now();
        acc.initials = acc.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'TM';
        acc.pin = acc.pin || '1234';
        this.accounts.push(acc);
        return acc;
      },
      updateAccount(id, fields) {
        const idx = this.accounts.findIndex(a => a.id === id);
        if (idx >= 0) this.accounts[idx] = { ...this.accounts[idx], ...fields };
        return this.accounts[idx];
      },
      deleteAccount(id) {
        if (id === 'acc_afiq') return false;
        this.accounts = this.accounts.filter(a => a.id !== id);
        return true;
      }
    };
  }

  const App = {
    currentView: 'dashboard',
    adminActiveTab: 'host-rates',
    pitchModeActive: false,
    selectedHostForDrawer: null,
    assessmentFilterReviewer: 'all',

    init() {
      try {
        this.updateAccountUI();
        this.bindNavigation();
        this.bindFilters();
        this.bindModals();
        this.bindThemeToggle();
        this.renderCurrentView();
      } catch (err) {
        console.error('App init error:', err);
        const area = document.getElementById('view-render-area');
        if (area) {
          area.innerHTML = '<div style="padding:40px;text-align:center;color:#fff;"><h3>Loading dashboard...</h3><p>' + err.message + '</p></div>';
        }
      }

      let resizeTimer;
      if (typeof window !== 'undefined' && window.addEventListener) {
        window.addEventListener('resize', () => {
          clearTimeout(resizeTimer);
          resizeTimer = setTimeout(() => this.renderCurrentView(), 200);
        });
      }
    },

    updateAccountUI() {
      const cur = Accounts.getCurrentAccount();
      if (!cur) return;

      const topbarAvatar = document.getElementById('topbar-user-avatar');
      const topbarName = document.getElementById('topbar-user-name');
      const topbarRole = document.getElementById('topbar-user-role');
      const sidebarAvatar = document.getElementById('sidebar-user-avatar');
      const sidebarName = document.getElementById('sidebar-user-name');
      const sidebarRole = document.getElementById('sidebar-user-role');

      if (topbarAvatar) {
        topbarAvatar.textContent = cur.initials;
        topbarAvatar.style.background = cur.avatarColor;
      }
      if (topbarName) topbarName.textContent = cur.name;
      if (topbarRole) topbarRole.textContent = cur.role.split(' ')[0];

      if (sidebarAvatar) {
        sidebarAvatar.textContent = cur.initials;
        sidebarAvatar.style.background = cur.avatarColor;
      }
      if (sidebarName) sidebarName.textContent = cur.name;
      if (sidebarRole) sidebarRole.textContent = cur.role;
    },

    bindNavigation() {
      const navItems = document.querySelectorAll('.nav-item[data-view]');
      navItems.forEach(item => {
        item.addEventListener('click', (e) => {
          e.preventDefault();
          const view = item.getAttribute('data-view');
          this.switchView(view);
        });
      });

      const pitchBtn = document.getElementById('btn-pitch-mode');
      if (pitchBtn) {
        pitchBtn.addEventListener('click', () => {
          this.togglePitchMode();
        });
      }

      // Account Switcher Buttons
      const topbarAccBtn = document.getElementById('topbar-account-btn');
      if (topbarAccBtn) {
        topbarAccBtn.addEventListener('click', () => this.openAccountSwitcherModal());
      }
      const sidebarAccBtn = document.getElementById('sidebar-account-btn');
      if (sidebarAccBtn) {
        sidebarAccBtn.addEventListener('click', () => this.openAccountSwitcherModal());
      }
    },

    switchView(viewName) {
      this.currentView = viewName;

      document.querySelectorAll('.nav-item').forEach(el => {
        if (el.getAttribute('data-view') === viewName) {
          el.classList.add('active');
        } else {
          el.classList.remove('active');
        }
      });

      const titles = {
        dashboard: 'Executive Overview',
        analytics: 'Live Session Analytics',
        hosts: 'Host Management & Raport',
        brands: 'Brand Intelligence & Pitching',
        payroll: 'Payroll Verification',
        assessment: 'Reviewer Assessment & Scoring Engine',
        reports: 'Intelligence Report Generator',
        admin: 'Admin Control Panel (Rates & Accounts)',
        settings: 'Configuration & Data Sync'
      };
      const titleEl = document.getElementById('current-page-title');
      if (titleEl) titleEl.textContent = titles[viewName] || 'Dashboard';

      this.renderCurrentView();
    },

    bindFilters() {
      // Platform Segmented Control
      const platformBtns = document.querySelectorAll('.platform-seg-btn');
      platformBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          platformBtns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          const val = btn.getAttribute('data-platform');
          Analytics.setFilter('platform', val);
          this.renderCurrentView();
        });
      });

      // Date Range Selector & Start+End Custom Range
      const dateSelect = document.getElementById('filter-date-range');
      const customDateBox = document.getElementById('custom-date-container');
      const startDateInput = document.getElementById('filter-start-date');
      const endDateInput = document.getElementById('filter-end-date');

      if (dateSelect) {
        dateSelect.addEventListener('change', (e) => {
          const val = e.target.value;
          if (val === 'custom') {
            if (customDateBox) customDateBox.style.display = 'flex';
            if (startDateInput) Analytics.setFilter('startDate', startDateInput.value);
            if (endDateInput) Analytics.setFilter('endDate', endDateInput.value);
            Analytics.setFilter('dateRange', 'custom');
          } else {
            if (customDateBox) customDateBox.style.display = 'none';
            Analytics.setFilter('dateRange', val);
          }
          this.renderCurrentView();
        });
      }

      if (startDateInput) {
        startDateInput.addEventListener('change', (e) => {
          Analytics.setFilter('startDate', e.target.value);
          Analytics.setFilter('dateRange', 'custom');
          if (dateSelect) dateSelect.value = 'custom';
          this.renderCurrentView();
        });
      }

      if (endDateInput) {
        endDateInput.addEventListener('change', (e) => {
          Analytics.setFilter('endDate', e.target.value);
          Analytics.setFilter('dateRange', 'custom');
          if (dateSelect) dateSelect.value = 'custom';
          this.renderCurrentView();
        });
      }

      // Brand Filter Selector
      const brandSelect = document.getElementById('filter-brand');
      if (brandSelect) {
        brandSelect.addEventListener('change', (e) => {
          Analytics.setFilter('brand', e.target.value);
          this.renderCurrentView();
        });
      }
    },

    bindThemeToggle() {
      const toggle = document.getElementById('theme-toggle-btn');
      if (toggle) {
        toggle.addEventListener('click', () => {
          const current = document.documentElement.getAttribute('data-theme') || 'dark';
          const next = current === 'dark' ? 'light' : 'dark';
          document.documentElement.setAttribute('data-theme', next);
          localStorage.setItem('fyc_theme', next);
          this.renderCurrentView();
        });
      }

      const savedTheme = localStorage.getItem('fyc_theme') || 'dark';
      document.documentElement.setAttribute('data-theme', savedTheme);
    },

    bindModals() {
      const syncBtn = document.getElementById('sync-trigger-btn');
      if (syncBtn) {
        syncBtn.addEventListener('click', () => this.openSyncModal());
      }

      const drawerClose = document.getElementById('close-drawer-btn');
      if (drawerClose) {
        drawerClose.addEventListener('click', () => this.closeHostDrawer());
      }
    },

    togglePitchMode() {
      this.pitchModeActive = !this.pitchModeActive;
      const pitchBtn = document.getElementById('btn-pitch-mode');
      if (this.pitchModeActive) {
        document.body.classList.add('pitch-mode');
        if (pitchBtn) pitchBtn.innerHTML = `<span>Exit Pitch Mode</span>`;
        this.switchView('brands');
      } else {
        document.body.classList.remove('pitch-mode');
        if (pitchBtn) pitchBtn.innerHTML = `<span>Client Pitch Mode</span>`;
        this.switchView('dashboard');
      }
    },

    // --- SUB-ACCOUNTS & SECURITY MODALS ---
    openAccountSwitcherModal() {
      const modal = document.getElementById('generic-modal');
      const container = document.getElementById('modal-inner-content');
      if (!modal || !container) return;

      const accounts = Accounts.getAccounts();
      const currentAcc = Accounts.getCurrentAccount();

      container.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
          <div>
            <h3 style="font-size:18px;font-weight:700">Sub-Accounts & Team Switcher</h3>
            <p style="font-size:12px;color:var(--text-tertiary)">Select an account to log in, grade hosts, verify payroll, or pitch brands</p>
          </div>
          <button class="apple-btn apple-btn-primary" style="padding:5px 12px;font-size:12px;" onclick="App.openAddAccountModal()">+ New Evaluator</button>
        </div>

        <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:20px;">
          ${accounts.map(acc => `
            <div class="account-item-card ${acc.id === currentAcc.id ? 'active-account' : ''}" onclick="App.requestAccountSwitch('${acc.id}')">
              <div style="display:flex;align-items:center;gap:12px;">
                <div class="user-avatar" style="background:${acc.avatarColor};width:40px;height:40px;font-size:14px;">
                  ${acc.initials}
                </div>
                <div>
                  <div style="font-size:14px;font-weight:600;color:var(--text-primary)">
                    ${acc.name} ${acc.id === currentAcc.id ? '<span style="font-size:10px;color:var(--apple-green);margin-left:6px;">● Logged In</span>' : ''}
                  </div>
                  <div style="font-size:11.5px;color:var(--text-secondary);margin-top:2px;">
                    ${acc.role} ${acc.pin ? '<span style="font-size:10px;color:var(--text-tertiary);margin-left:6px;">🔒 PIN Protected</span>' : ''}
                  </div>
                  <div style="font-size:10.5px;color:var(--text-tertiary);">
                    ${acc.description || ''}
                  </div>
                </div>
              </div>
              <div style="display:flex;align-items:center;gap:8px;">
                ${acc.canGrade ? '<span class="tier-badge" style="background:rgba(48,209,88,0.15);color:var(--apple-green)">Evaluator</span>' : ''}
                ${acc.id !== 'acc_afiq' ? `
                  <button class="review-action-btn delete" onclick="event.stopPropagation(); App.deleteAccount('${acc.id}')" title="Delete this sub-account">
                    ✕
                  </button>
                ` : ''}
                <button class="apple-btn apple-btn-secondary" style="padding:4px 10px;font-size:11px;">
                  ${acc.id === currentAcc.id ? 'Current' : 'Switch'}
                </button>
              </div>
            </div>
          `).join('')}
        </div>

        <div style="display:flex;justify-content:space-between;align-items:center;">
          <button class="apple-btn apple-btn-secondary" onclick="App.switchView('admin'); App.closeModal();">Open Admin Management Panel</button>
          <button class="apple-btn apple-btn-secondary" onclick="App.closeModal()">Close</button>
        </div>
      `;

      modal.classList.add('active');
    },

    requestAccountSwitch(targetAccountId) {
      const currentAcc = Accounts.getCurrentAccount();
      if (currentAcc.id === targetAccountId) {
        this.closeModal();
        return;
      }

      const targetAcc = Accounts.getAccount(targetAccountId);
      if (!targetAcc) return;

      // If target account has PIN and current user is not super-admin, prompt PIN
      if (targetAcc.pin && targetAcc.pin.trim() !== '' && currentAcc.id !== 'acc_afiq') {
        this.openVerifyPinModal(targetAccountId);
      } else {
        this.selectAccount(targetAccountId);
      }
    },

    openVerifyPinModal(targetAccountId) {
      const targetAcc = Accounts.getAccount(targetAccountId);
      if (!targetAcc) return;

      const modal = document.getElementById('generic-modal');
      const container = document.getElementById('modal-inner-content');
      if (!modal || !container) return;

      container.innerHTML = `
        <div style="text-align:center;padding:10px 0;">
          <div class="user-avatar" style="background:${targetAcc.avatarColor};width:54px;height:54px;font-size:18px;margin:0 auto 14px auto;">
            ${targetAcc.initials}
          </div>
          <h3 style="font-size:18px;font-weight:700">Enter PIN for ${targetAcc.name}</h3>
          <p style="font-size:12px;color:var(--text-tertiary);margin-top:4px;margin-bottom:16px;">
            Role: ${targetAcc.role}
          </p>

          <form id="verify-pin-form" style="display:flex;flex-direction:column;gap:14px;max-width:240px;margin:0 auto;">
            <input type="password" id="input-account-pin" maxlength="10" required autofocus placeholder="Enter PIN..." class="select-filter" style="text-align:center;font-size:18px;letter-spacing:0.25em;padding:8px;" />
            <div id="pin-error-msg" style="color:var(--apple-red);font-size:11.5px;display:none;">Incorrect PIN. Please try again.</div>

            <div style="display:flex;gap:10px;justify-content:center;margin-top:8px;">
              <button type="button" class="apple-btn apple-btn-secondary" onclick="App.openAccountSwitcherModal()">Back</button>
              <button type="submit" class="apple-btn apple-btn-primary">Unlock & Switch</button>
            </div>
          </form>
        </div>
      `;

      document.getElementById('verify-pin-form').onsubmit = async (e) => {
        e.preventDefault();
        const pinInput = document.getElementById('input-account-pin');
        const errorEl = document.getElementById('pin-error-msg');
        const submitBtn = e.submitter;
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = 'Checking…';
        }

        const valid = await Accounts.verifyPin(targetAccountId, pinInput.value);
        if (valid) {
          this.selectAccount(targetAccountId);
        } else {
          if (errorEl) errorEl.style.display = 'block';
          pinInput.value = '';
          pinInput.focus();
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Unlock & Switch';
          }
        }
      };

      modal.classList.add('active');
    },

    selectAccount(accountId) {
      Accounts.switchAccount(accountId);
      this.updateAccountUI();
      this.closeModal();
      this.renderCurrentView();
      if (this.selectedHostForDrawer) {
        this.openHostDrawer(this.selectedHostForDrawer);
      }
    },

    deleteAccount(accountId) {
      const acc = Accounts.getAccount(accountId);
      if (!acc) return;

      if (confirm(`Are you sure you want to delete sub-account "${acc.name}" (${acc.role})?`)) {
        if (Accounts.deleteAccount(accountId)) {
          this.updateAccountUI();
          this.openAccountSwitcherModal();
          this.renderCurrentView();
        }
      }
    },

    openAddAccountModal() {
      const modal = document.getElementById('generic-modal');
      const container = document.getElementById('modal-inner-content');
      if (!modal || !container) return;

      container.innerHTML = `
        <h3 style="font-size:18px;font-weight:700;margin-bottom:16px;">Add New Team Evaluator / Sub-Account</h3>
        <form id="new-account-form" style="display:flex;flex-direction:column;gap:14px;">
          <div>
            <label style="font-size:12px;color:var(--text-secondary);display:block;margin-bottom:4px;">Full Name</label>
            <input type="text" id="new-acc-name" required placeholder="e.g. Sarah Quality Lead" class="select-filter" style="width:100%" />
          </div>

          <div>
            <label style="font-size:12px;color:var(--text-secondary);display:block;margin-bottom:4px;">Role & Title</label>
            <input type="text" id="new-acc-role" required placeholder="e.g. Senior Shift Evaluator" class="select-filter" style="width:100%" />
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div>
              <label style="font-size:12px;color:var(--text-secondary);display:block;margin-bottom:4px;">Access PIN / Password</label>
              <input type="password" id="new-acc-pin" required autocomplete="new-password" placeholder="Set access PIN" class="select-filter" style="width:100%;font-family:monospace" />
            </div>
            <div>
              <label style="font-size:12px;color:var(--text-secondary);display:block;margin-bottom:4px;">Avatar Color</label>
              <input type="color" id="new-acc-color" value="#0071e3" style="width:100%;height:36px;border:none;border-radius:6px;cursor:pointer;background:transparent" />
            </div>
          </div>

          <div>
            <label style="font-size:12px;color:var(--text-secondary);display:block;margin-bottom:4px;">Role Description</label>
            <input type="text" id="new-acc-desc" placeholder="e.g. Evaluator for evening beauty shifts" class="select-filter" style="width:100%" />
          </div>

          <div style="display:flex;flex-direction:column;gap:8px;padding:12px;background:rgba(255,255,255,0.03);border-radius:var(--radius-sm);border:1px solid var(--border-subtle)">
            <span style="font-size:11.5px;font-weight:600;color:var(--text-primary)">Permissions:</span>
            <label style="display:flex;align-items:center;gap:8px;font-size:12px;cursor:pointer">
              <input type="checkbox" id="new-acc-grade" checked /> Can grade and review creators (Evaluator)
            </label>
            <label style="display:flex;align-items:center;gap:8px;font-size:12px;cursor:pointer">
              <input type="checkbox" id="new-acc-rates" /> Can manage host hourly rate cards
            </label>
            <label style="display:flex;align-items:center;gap:8px;font-size:12px;cursor:pointer">
              <input type="checkbox" id="new-acc-payroll" /> Can verify and approve payroll
            </label>
          </div>

          <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:12px;">
            <button type="button" class="apple-btn apple-btn-secondary" onclick="App.openAccountSwitcherModal()">Back</button>
            <button type="submit" class="apple-btn apple-btn-primary">Create Sub-Account</button>
          </div>
        </form>
      `;

      document.getElementById('new-account-form').onsubmit = (e) => {
        e.preventDefault();
        const name = document.getElementById('new-acc-name').value.trim();
        const role = document.getElementById('new-acc-role').value.trim();
        const pin = document.getElementById('new-acc-pin').value.trim() || '1234';
        const avatarColor = document.getElementById('new-acc-color').value;
        const description = document.getElementById('new-acc-desc').value.trim() || 'Team Evaluator';
        const canGrade = document.getElementById('new-acc-grade').checked;
        const canManageRates = document.getElementById('new-acc-rates').checked;
        const canApprovePayroll = document.getElementById('new-acc-payroll').checked;

        const newAcc = Accounts.addAccount({
          name,
          role,
          pin,
          avatarColor,
          description,
          canGrade,
          canManageRates,
          canApprovePayroll,
          roleType: canGrade ? 'evaluator' : 'operator'
        });

        Accounts.switchAccount(newAcc.id);
        this.updateAccountUI();
        this.closeModal();
        this.renderCurrentView();
      };
    },

    openEditAccountModal(accountId) {
      const acc = Accounts.getAccount(accountId);
      if (!acc) return;

      const modal = document.getElementById('generic-modal');
      const container = document.getElementById('modal-inner-content');
      if (!modal || !container) return;

      container.innerHTML = `
        <h3 style="font-size:18px;font-weight:700;margin-bottom:16px;">Edit Sub-Account: ${acc.name}</h3>
        <form id="edit-account-form" style="display:flex;flex-direction:column;gap:14px;">
          <div>
            <label style="font-size:12px;color:var(--text-secondary);display:block;margin-bottom:4px;">Full Name</label>
            <input type="text" id="edit-acc-name" value="${acc.name}" required class="select-filter" style="width:100%" />
          </div>

          <div>
            <label style="font-size:12px;color:var(--text-secondary);display:block;margin-bottom:4px;">Role & Title</label>
            <input type="text" id="edit-acc-role" value="${acc.role}" required class="select-filter" style="width:100%" />
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div>
              <label style="font-size:12px;color:var(--text-secondary);display:block;margin-bottom:4px;">PIN / Password</label>
              <input type="password" id="edit-acc-pin" value="" autocomplete="new-password" placeholder="Leave blank to keep current PIN" class="select-filter" style="width:100%;font-family:monospace" />
            </div>
            <div>
              <label style="font-size:12px;color:var(--text-secondary);display:block;margin-bottom:4px;">Avatar Color</label>
              <input type="color" id="edit-acc-color" value="${acc.avatarColor || '#0071e3'}" style="width:100%;height:36px;border:none;border-radius:6px;cursor:pointer;background:transparent" />
            </div>
          </div>

          <div>
            <label style="font-size:12px;color:var(--text-secondary);display:block;margin-bottom:4px;">Role Description</label>
            <input type="text" id="edit-acc-desc" value="${acc.description || ''}" class="select-filter" style="width:100%" />
          </div>

          <div style="display:flex;flex-direction:column;gap:8px;padding:12px;background:rgba(255,255,255,0.03);border-radius:var(--radius-sm);border:1px solid var(--border-subtle)">
            <span style="font-size:11.5px;font-weight:600;color:var(--text-primary)">Permissions:</span>
            <label style="display:flex;align-items:center;gap:8px;font-size:12px;cursor:pointer">
              <input type="checkbox" id="edit-acc-grade" ${acc.canGrade ? 'checked' : ''} /> Can grade and review creators (Evaluator)
            </label>
            <label style="display:flex;align-items:center;gap:8px;font-size:12px;cursor:pointer">
              <input type="checkbox" id="edit-acc-rates" ${acc.canManageRates ? 'checked' : ''} /> Can manage host hourly rate cards
            </label>
            <label style="display:flex;align-items:center;gap:8px;font-size:12px;cursor:pointer">
              <input type="checkbox" id="edit-acc-payroll" ${acc.canApprovePayroll ? 'checked' : ''} /> Can verify and approve payroll
            </label>
            <label style="display:flex;align-items:center;gap:8px;font-size:12px;cursor:pointer">
              <input type="checkbox" id="edit-acc-accounts" ${acc.canManageAccounts ? 'checked' : ''} /> Can manage sub-accounts & security
            </label>
          </div>

          <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:12px;">
            <button type="button" class="apple-btn apple-btn-secondary" onclick="App.closeModal()">Cancel</button>
            <button type="submit" class="apple-btn apple-btn-primary">Save Changes</button>
          </div>
        </form>
      `;

      document.getElementById('edit-account-form').onsubmit = (e) => {
        e.preventDefault();
        const name = document.getElementById('edit-acc-name').value.trim();
        const role = document.getElementById('edit-acc-role').value.trim();
        const pin = document.getElementById('edit-acc-pin').value.trim();
        const avatarColor = document.getElementById('edit-acc-color').value;
        const description = document.getElementById('edit-acc-desc').value.trim();
        const canGrade = document.getElementById('edit-acc-grade').checked;
        const canManageRates = document.getElementById('edit-acc-rates').checked;
        const canApprovePayroll = document.getElementById('edit-acc-payroll').checked;
        const canManageAccounts = document.getElementById('edit-acc-accounts').checked;

        const accountUpdates = {
          name,
          role,
          avatarColor,
          description,
          canGrade,
          canManageRates,
          canApprovePayroll,
          canManageAccounts
        };
        if (pin) accountUpdates.pin = pin;
        Accounts.updateAccount(accountId, accountUpdates);

        this.updateAccountUI();
        this.closeModal();
        this.renderCurrentView();
      };

      modal.classList.add('active');
    },

    // --- VIEW DISPATCHER ---
    renderCurrentView() {
      const container = document.getElementById('view-render-area');
      if (!container) return;

      let data;
      if (window.AppStore) {
        data = window.AppStore.viewData(this.currentView);
      } else {
        const sessions = Analytics.getFilteredSessions();
        const hostAggs = Analytics.getHostAggregates(sessions);
        data = {
          sessions,
          kpis: Analytics.calculateKPIs(sessions),
          hostAggs,
          scoredHosts: Scoring.computeAllHostScores(hostAggs),
          brandBreakdown: Analytics.getBrandBreakdown(sessions),
          platformComp: Analytics.getPlatformComparison(sessions),
          gmvTrend: Analytics.getGMVTrend(sessions)
        };
      }

      switch (this.currentView) {
        case 'dashboard':
          this.renderDashboardView(container, data);
          break;
        case 'analytics':
          this.renderAnalyticsView(container, data);
          break;
        case 'hosts':
          this.renderHostsView(container, data);
          break;
        case 'brands':
          this.renderBrandsView(container, data);
          break;
        case 'payroll':
          this.renderPayrollView(container, data);
          break;
        case 'assessment':
          this.renderAssessmentView(container, data);
          break;
        case 'reports':
          this.renderReportsView(container, data);
          break;
        case 'admin':
          this.renderAdminView(container, data);
          break;
        case 'settings':
          this.renderSettingsView(container);
          break;
        default:
          this.renderDashboardView(container, window.AppStore ? window.AppStore.viewData('dashboard') : data);
      }
    },

    // 1. EXECUTIVE DASHBOARD VIEW
    renderDashboardView(container, data) {
      const { kpis, scoredHosts, brandBreakdown, platformComp, gmvTrend } = data;

      container.innerHTML = `
        <div class="kpi-grid">
          <div class="glass-card kpi-card">
            <div class="kpi-header">
              <span class="kpi-label">Total Live GMV</span>
              <div class="kpi-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              </div>
            </div>
            <div class="kpi-value">${AppleCharts.formatIDRShort(kpis.totalGMV)}</div>
            <div class="kpi-meta">
              <span class="delta-badge positive">+18.4%</span>
              <span>vs target benchmark</span>
            </div>
          </div>

          <div class="glass-card kpi-card">
            <div class="kpi-header">
              <span class="kpi-label">Total Live Hours</span>
              <div class="kpi-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              </div>
            </div>
            <div class="kpi-value">${kpis.totalDuration.toLocaleString('id-ID')} <span style="font-size:14px;font-weight:500;color:var(--text-tertiary)">hrs</span></div>
            <div class="kpi-meta">
              <span class="delta-badge neutral">${kpis.sessionCount.toLocaleString()} sessions</span>
              <span>completed</span>
            </div>
          </div>

          <div class="glass-card kpi-card">
            <div class="kpi-header">
              <span class="kpi-label">Average GMV / Hour</span>
              <div class="kpi-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
              </div>
            </div>
            <div class="kpi-value">${AppleCharts.formatIDRShort(kpis.avgGmvHour)}</div>
            <div class="kpi-meta">
              <span class="delta-badge positive">+12.1%</span>
              <span>productivity index</span>
            </div>
          </div>

          <div class="glass-card kpi-card">
            <div class="kpi-header">
              <span class="kpi-label">Active Creators</span>
              <div class="kpi-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              </div>
            </div>
            <div class="kpi-value">${kpis.activeHosts} <span style="font-size:14px;font-weight:500;color:var(--text-tertiary)">hosts</span></div>
            <div class="kpi-meta">
              <span class="delta-badge neutral">${kpis.activeBrands} Brands</span>
              <span>assigned</span>
            </div>
          </div>

          <div class="glass-card kpi-card">
            <div class="kpi-header">
              <span class="kpi-label">Avg CTOR (Conversion)</span>
              <div class="kpi-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="m4.93 4.93 4.24 4.24"/></svg>
              </div>
            </div>
            <div class="kpi-value">${kpis.avgCtor.toFixed(2)}%</div>
            <div class="kpi-meta">
              <span>Avg CTR: <strong>${kpis.avgCtr.toFixed(1)}%</strong></span>
            </div>
          </div>
        </div>

        <div class="charts-grid-2">
          <div class="glass-card">
            <div class="card-header">
              <div class="card-title-group">
                <h3>GMV Performance Trajectory</h3>
                <p>Daily livestream revenue trend across all managed brands</p>
              </div>
              <div class="delta-badge positive">All Channels</div>
            </div>
            <div class="chart-wrapper">
              <canvas id="gmvTrendCanvas" class="chart-canvas"></canvas>
            </div>
          </div>

          <div class="glass-card">
            <div class="card-header">
              <div class="card-title-group">
                <h3>Brand Share Distribution</h3>
                <p>Gross merchandise value contribution</p>
              </div>
            </div>
            <div class="chart-wrapper">
              <canvas id="brandDonutCanvas" class="chart-canvas"></canvas>
            </div>
          </div>
        </div>

        <div class="charts-grid-2">
          <div class="glass-card">
            <div class="card-header">
              <div class="card-title-group">
                <h3>Platform Efficiency: TikTok vs Shopee</h3>
                <p>Volume, duration, and productivity metrics</p>
              </div>
            </div>
            <div class="chart-wrapper">
              <canvas id="platformBarCanvas" class="chart-canvas"></canvas>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:16px;">
              <div style="padding:12px;background:rgba(255,255,255,0.03);border-radius:var(--radius-sm)">
                <div style="font-size:11px;color:var(--apple-cyan);font-weight:600">TikTok Live</div>
                <div style="font-size:16px;font-weight:700;margin-top:2px">${AppleCharts.formatIDRShort(platformComp.TikTok.gmv)}</div>
                <div style="font-size:11px;color:var(--text-tertiary)">${platformComp.TikTok.duration.toFixed(0)} hrs • Rp ${(platformComp.TikTok.gmvHour).toLocaleString('id-ID', {maximumFractionDigits:0})}/hr</div>
              </div>
              <div style="padding:12px;background:rgba(255,255,255,0.03);border-radius:var(--radius-sm)">
                <div style="font-size:11px;color:var(--apple-orange);font-weight:600">Shopee Live</div>
                <div style="font-size:16px;font-weight:700;margin-top:2px">${AppleCharts.formatIDRShort(platformComp.Shopee.gmv)}</div>
                <div style="font-size:11px;color:var(--text-tertiary)">${platformComp.Shopee.duration.toFixed(0)} hrs • Rp ${(platformComp.Shopee.gmvHour).toLocaleString('id-ID', {maximumFractionDigits:0})}/hr</div>
              </div>
            </div>
          </div>

          <div class="glass-card">
            <div class="card-header">
              <div class="card-title-group">
                <h3>Top Host Leaderboard</h3>
                <p>Ranked by unified performance intelligence score</p>
              </div>
              <a href="#" class="apple-btn apple-btn-secondary" onclick="App.switchView('hosts'); return false;" style="padding:4px 10px;font-size:11.5px">View All</a>
            </div>
            <div class="leaderboard-list">
              ${scoredHosts.slice(0, 5).map(h => `
                <div class="leaderboard-item" onclick="App.openHostDrawer('${h.name}')">
                  <div class="rank-badge ${h.rank === 1 ? 'rank-1' : (h.rank === 2 ? 'rank-2' : (h.rank === 3 ? 'rank-3' : 'rank-other'))}">
                    ${h.rank}
                  </div>
                  <div class="host-avatar" style="background:${h.tierColor || '#0071e3'}">
                    ${h.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div class="host-info">
                    <div class="name">${h.name}</div>
                    <div class="meta">
                      <span>${h.tier}</span>
                      <span>•</span>
                      <span>${h.duration.toFixed(0)}h</span>
                      <span>•</span>
                      <span>CTOR: ${h.avgCtor.toFixed(1)}%</span>
                    </div>
                  </div>
                  <div class="host-metric-pill">
                    <div class="gmv">${AppleCharts.formatIDRShort(h.gmv)}</div>
                    <div class="sub">Score: ${h.finalScore.toFixed(1)}%</div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      `;

      setTimeout(() => {
        const trendCanvas = document.getElementById('gmvTrendCanvas');
        if (trendCanvas) {
          AppleCharts.drawAreaChart(trendCanvas, {
            data: gmvTrend,
            color: '#0071e3',
            gradientTop: 'rgba(0, 113, 227, 0.35)'
          });
        }

        const brandCanvas = document.getElementById('brandDonutCanvas');
        if (brandCanvas) {
          AppleCharts.drawDonutChart(brandCanvas, {
            data: brandBreakdown.map(b => ({
              label: b.brand,
              value: b.gmv,
              color: b.color
            })),
            centerTitle: AppleCharts.formatIDRShort(kpis.totalGMV),
            centerSub: 'Total GMV'
          });
        }

        const barCanvas = document.getElementById('platformBarCanvas');
        if (barCanvas) {
          AppleCharts.drawBarChart(barCanvas, {
            categories: ['GMV (Jt)', 'Hours', 'Sessions'],
            series: [
              { name: 'TikTok', color: '#2997ff', data: [platformComp.TikTok.gmv / 1e6, platformComp.TikTok.duration, platformComp.TikTok.sessions] },
              { name: 'Shopee', color: '#ff9f0a', data: [platformComp.Shopee.gmv / 1e6, platformComp.Shopee.duration, platformComp.Shopee.sessions] }
            ]
          });
        }
      }, 50);
    },

    // 2. LIVE SESSION ANALYTICS VIEW
    renderAnalyticsView(container, data) {
      const { sessions, platformComp } = data;
      const timeSlots = Analytics.getTimeSlotAnalysis(sessions);
      const topProducts = Analytics.getTopProducts(sessions, 8);

      container.innerHTML = `
        <div class="charts-grid-2">
          <div class="glass-card">
            <div class="card-header">
              <div class="card-title-group">
                <h3>Broadcast Slot Productivity</h3>
                <p>Revenue and hours by time of day</p>
              </div>
            </div>
            <div class="chart-wrapper">
              <canvas id="slotBarCanvas" class="chart-canvas"></canvas>
            </div>
          </div>

          <div class="glass-card">
            <div class="card-header">
              <div class="card-title-group">
                <h3>Top Selling Hero Products</h3>
                <p>Most converted items during livestream sessions</p>
              </div>
            </div>
            <div style="display:flex;flex-direction:column;gap:10px;">
              ${topProducts.map((p, i) => `
                <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:rgba(255,255,255,0.03);border-radius:var(--radius-sm)">
                  <div style="max-width:70%">
                    <div style="font-size:12.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${i+1}. ${p.product}</div>
                    <div style="font-size:10.5px;color:var(--text-tertiary)">Brand: ${p.brand} • ${p.sessions} live shifts</div>
                  </div>
                  <div style="text-align:right">
                    <div style="font-size:13px;font-weight:700;color:var(--apple-cyan)">${p.sold.toLocaleString()} pcs</div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>

        <div class="glass-card">
          <div class="card-header">
            <div class="card-title-group">
              <h3>Livestream Session Master Log</h3>
              <p>Granular breakdown of all ${sessions.length.toLocaleString()} shifts recorded</p>
            </div>
            <div style="display:flex;gap:10px;">
              <input type="text" id="session-search-input" placeholder="Search host, brand, product..." class="select-filter" style="width:240px" />
              <button class="apple-btn apple-btn-secondary" onclick="App.exportSessionsCSV()">Export CSV</button>
            </div>
          </div>

          <div class="table-responsive">
            <table class="apple-table" id="session-master-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Brand</th>
                  <th>Platform</th>
                  <th>Host</th>
                  <th>Time / Dur</th>
                  <th>GMV</th>
                  <th>GMV/Hour</th>
                  <th>CTR</th>
                  <th>CTOR</th>
                  <th>Sold</th>
                </tr>
              </thead>
              <tbody id="session-table-body"></tbody>
            </table>
          </div>
          <div id="session-pagination" style="display:flex;justify-content:space-between;align-items:center;margin-top:16px;padding-top:12px;border-top:1px solid var(--border-subtle)"></div>
        </div>
      `;

      this.initSessionTablePagination(sessions);

      setTimeout(() => {
        const slotCanvas = document.getElementById('slotBarCanvas');
        if (slotCanvas) {
          AppleCharts.drawBarChart(slotCanvas, {
            categories: timeSlots.map(s => s.name.split(' ')[0]),
            series: [
              { name: 'GMV (Jt)', color: '#af52de', data: timeSlots.map(s => s.gmv / 1e6) },
              { name: 'Duration (h)', color: '#2997ff', data: timeSlots.map(s => s.duration) }
            ]
          });
        }
      }, 50);
    },

    initSessionTablePagination(sessions) {
      let currentPage = 1;
      const pageSize = 15;
      let filtered = [...sessions];

      const searchInput = document.getElementById('session-search-input');
      if (searchInput) {
        searchInput.addEventListener('input', (e) => {
          const q = e.target.value.toLowerCase();
          filtered = sessions.filter(s => 
            s.host.toLowerCase().includes(q) ||
            s.brand.toLowerCase().includes(q) ||
            (s.product && s.product.toLowerCase().includes(q))
          );
          currentPage = 1;
          renderPage();
        });
      }

      const renderPage = () => {
        const tbody = document.getElementById('session-table-body');
        const pagination = document.getElementById('session-pagination');
        if (!tbody) return;

        const startIdx = (currentPage - 1) * pageSize;
        const pageItems = filtered.slice(startIdx, startIdx + pageSize);

        tbody.innerHTML = pageItems.map(s => `
          <tr>
            <td>${s.date}</td>
            <td><span class="brand-tag">${s.brand}</span></td>
            <td><span class="platform-pill ${s.platform.toLowerCase()}">${s.platform}</span></td>
            <td><strong>${s.host}</strong></td>
            <td>${s.start} - ${s.end} (${s.duration}h)</td>
            <td style="font-weight:600;color:var(--apple-cyan)">${AppleCharts.formatIDR(s.gmv)}</td>
            <td>${AppleCharts.formatIDR(s.gmv_hr)}</td>
            <td>${s.ctr.toFixed(1)}%</td>
            <td><strong>${s.ctor.toFixed(1)}%</strong></td>
            <td>${s.sold_qty} pcs</td>
          </tr>
        `).join('');

        const totalPages = Math.ceil(filtered.length / pageSize) || 1;
        pagination.innerHTML = `
          <span style="font-size:12px;color:var(--text-tertiary)">Showing ${startIdx + 1} - ${Math.min(startIdx + pageSize, filtered.length)} of ${filtered.length} sessions</span>
          <div style="display:flex;gap:6px;">
            <button class="apple-btn apple-btn-secondary" style="padding:4px 10px;font-size:11.5px" ${currentPage === 1 ? 'disabled' : ''} id="prev-page-btn">Prev</button>
            <span style="display:flex;align-items:center;padding:0 8px;font-size:12px">Page ${currentPage} of ${totalPages}</span>
            <button class="apple-btn apple-btn-secondary" style="padding:4px 10px;font-size:11.5px" ${currentPage === totalPages ? 'disabled' : ''} id="next-page-btn">Next</button>
          </div>
        `;

        const prevBtn = document.getElementById('prev-page-btn');
        const nextBtn = document.getElementById('next-page-btn');
        if (prevBtn) prevBtn.onclick = () => { if (currentPage > 1) { currentPage--; renderPage(); } };
        if (nextBtn) nextBtn.onclick = () => { if (currentPage < totalPages) { currentPage++; renderPage(); } };
      };

      renderPage();
    },

    // 3. HOST MANAGEMENT VIEW
    renderHostsView(container, data) {
      const { scoredHosts } = data;
      const currentAcc = Accounts.getCurrentAccount();

      container.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <div>
            <h2 style="font-size:20px;font-weight:700">Creator Performance & Raport</h2>
            <p style="font-size:12.5px;color:var(--text-tertiary)">Click any creator card to view profile, rate card history, and multi-reviewer evaluations</p>
          </div>
          <button class="apple-btn apple-btn-primary" onclick="App.openAddReviewModal()">+ Add Host Assessment</button>
        </div>

        <div class="hosts-card-grid">
          ${scoredHosts.map(h => {
            const myReview = Scoring.getHostReviewByReviewer(h.name, currentAcc.name);
            return `
              <div class="glass-card host-card" onclick="App.openHostDrawer('${h.name}')">
                <div class="host-card-top">
                  <div class="host-card-avatar" style="background:${h.tierColor || '#0071e3'}">
                    ${h.name.substring(0, 2).toUpperCase()}
                    <span style="position:absolute;bottom:-4px;right:-4px;background:#141418;border-radius:50%;padding:2px 5px;font-size:9px;border:1px solid rgba(255,255,255,0.2)">#${h.rank}</span>
                  </div>
                  <div>
                    <div style="font-size:16px;font-weight:700">${h.name}</div>
                    <div style="display:flex;gap:6px;margin-top:4px;">
                      <span class="tier-badge" style="background:${h.tierColor}25;color:${h.tierColor}">${h.tier}</span>
                      <span class="tier-badge" style="background:rgba(255,255,255,0.08);color:var(--text-secondary)">Score: ${h.finalScore.toFixed(1)}%</span>
                    </div>
                  </div>
                </div>

                <div class="host-stats-row">
                  <div class="host-stat-box">
                    <div class="title">Total GMV</div>
                    <div class="val" style="color:var(--apple-cyan)">${AppleCharts.formatIDRShort(h.gmv)}</div>
                  </div>
                  <div class="host-stat-box">
                    <div class="title">Duration</div>
                    <div class="val">${h.duration.toFixed(0)}h</div>
                  </div>
                  <div class="host-stat-box">
                    <div class="title">GMV/Hour</div>
                    <div class="val">${AppleCharts.formatIDRShort(h.gmvHour)}</div>
                  </div>
                </div>

                <div style="font-size:11.5px;color:var(--text-tertiary);display:flex;justify-content:space-between;padding:4px 2px;">
                  <span>Brands: <strong>${h.brands.join(', ')}</strong></span>
                  <span>CTOR: <strong>${h.avgCtor.toFixed(1)}%</strong></span>
                </div>

                <div style="display:flex;gap:8px;margin-top:auto" onclick="event.stopPropagation()">
                  ${myReview ? `
                    <button class="apple-btn apple-btn-secondary" style="flex:1;justify-content:center;padding:6px 0;font-size:11.5px;color:var(--apple-cyan)" onclick="App.openEditReviewModal('${myReview.id}')">
                      ✏️ Edit My Review (${myReview.cta.toFixed(1)})
                    </button>
                  ` : `
                    <button class="apple-btn apple-btn-primary" style="flex:1;justify-content:center;padding:6px 0;font-size:11.5px" onclick="App.openAddReviewModal('${h.name}')">
                      ★ Grade Host
                    </button>
                  `}
                  <button class="apple-btn apple-btn-secondary" style="padding:6px 12px;font-size:11.5px" onclick="App.openHostDrawer('${h.name}')">Raport</button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    },

    // 4. BRAND ANALYTICS VIEW
    renderBrandsView(container, data) {
      const { brandBreakdown } = data;
      const isPitch = this.pitchModeActive;

      container.innerHTML = `
        <div class="${isPitch ? 'pitch-mode-view' : ''}">
          <div class="pitch-hero">
            <div>
              <div style="display:inline-block;padding:3px 10px;border-radius:var(--radius-pill);background:rgba(0,113,227,0.2);color:var(--apple-cyan);font-size:11px;font-weight:600;margin-bottom:8px">
                ${isPitch ? 'CLIENT PRESENTATION DECK' : 'BRAND PORTFOLIO INTELLIGENCE'}
              </div>
              <h2>Livestream Performance & ROI Matrix</h2>
              <p style="font-size:13.5px;color:var(--text-secondary);margin-top:4px">
                Comprehensive data intelligence across all portfolio brands, GMV conversion, and audience reach
              </p>
            </div>
            <div>
              <button class="apple-btn apple-btn-primary" onclick="window.print()">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                <span>Export Pitch Deck (PDF)</span>
              </button>
            </div>
          </div>

          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(320px, 1fr));gap:20px;">
            ${brandBreakdown.map(b => `
              <div class="glass-card">
                <div class="card-header">
                  <div>
                    <h3 style="font-size:17px;font-weight:700">${b.brand}</h3>
                    <p style="font-size:12px;color:var(--text-tertiary)">${b.platforms.join(' & ')} • ${b.hostCount} Dedicated Hosts</p>
                  </div>
                  <span class="delta-badge positive">${b.share.toFixed(1)}% Share</span>
                </div>

                <div style="margin:16px 0;">
                  <div style="font-size:24px;font-weight:700;color:var(--apple-cyan)">${AppleCharts.formatIDR(b.gmv)}</div>
                  <div style="font-size:11.5px;color:var(--text-tertiary);margin-top:2px">
                    ${b.duration.toFixed(0)} live broadcast hours • ${b.sessions} shifts • Avg ${AppleCharts.formatIDRShort(b.gmvHour)}/hr
                  </div>
                </div>

                <div style="border-top:1px solid var(--border-subtle);padding-top:12px;display:flex;justify-content:space-between;font-size:12px;">
                  <span>Audience Reach: <strong>${(b.views).toLocaleString()} views</strong></span>
                  <span>Items Sold: <strong>${(b.sold).toLocaleString()} pcs</strong></span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    },

    // 5. PAYROLL VERIFICATION VIEW
    renderPayrollView(container, data) {
      const { hostAggs } = data;
      const payrollSummary = Payroll.calculatePayrollSummary(hostAggs, '2026-09');

      container.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <div>
            <h2 style="font-size:20px;font-weight:700">Creator Payroll Validation & Settlement</h2>
            <p style="font-size:12.5px;color:var(--text-tertiary)">Formula: Approved Live Hours × Applicable Rate + Performance Milestone Incentive</p>
          </div>
          <div style="display:flex;gap:10px;">
            <button class="apple-btn apple-btn-secondary" onclick="App.approveAllPayroll()">Approve All</button>
            <button class="apple-btn apple-btn-primary" onclick="App.exportPayrollCSV()">Export Payroll CSV</button>
          </div>
        </div>

        <div class="kpi-grid">
          <div class="glass-card kpi-card">
            <span class="kpi-label">Total Payroll Payout</span>
            <div class="kpi-value" style="color:var(--apple-green)">${AppleCharts.formatIDRShort(payrollSummary.totalFinalPayoutAll)}</div>
            <div class="kpi-meta">Base: ${AppleCharts.formatIDRShort(payrollSummary.totalBasePayoutAll)} + Bonus</div>
          </div>
          <div class="glass-card kpi-card">
            <span class="kpi-label">Total Approved Live Hours</span>
            <div class="kpi-value">${payrollSummary.totalHoursAll.toFixed(0)} <span style="font-size:14px;font-weight:500;color:var(--text-tertiary)">hrs</span></div>
            <div class="kpi-meta">Across 15 creators</div>
          </div>
          <div class="glass-card kpi-card">
            <span class="kpi-label">Total Performance Incentive</span>
            <div class="kpi-value" style="color:var(--apple-yellow)">${AppleCharts.formatIDRShort(payrollSummary.totalBonusAll)}</div>
            <div class="kpi-meta">Top conversion bonuses</div>
          </div>
        </div>

        <div class="glass-card">
          <div class="card-header">
            <div class="card-title-group">
              <h3>Monthly Host Payroll Verification</h3>
              <p>Period: July - September 2026 Settlement</p>
            </div>
          </div>

          <div class="table-responsive">
            <table class="apple-table">
              <thead>
                <tr>
                  <th>Host</th>
                  <th>Approved Hours</th>
                  <th>Hourly Rate</th>
                  <th>Base Pay</th>
                  <th>Incentive / Bonus</th>
                  <th>Total Payment</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                ${payrollSummary.items.map(p => `
                  <tr>
                    <td><strong>${p.name}</strong></td>
                    <td>${p.hours.toFixed(1)} hrs (${p.sessions} shifts)</td>
                    <td>
                      <span style="font-weight:600">${AppleCharts.formatIDR(p.rate)}</span>/hr
                      <button class="apple-btn apple-btn-secondary" style="padding:1px 6px;font-size:10px;margin-left:6px" onclick="App.openAdjustRateModal('${p.name}')">Edit</button>
                    </td>
                    <td>${AppleCharts.formatIDR(p.basePay)}</td>
                    <td>
                      <span style="color:var(--apple-yellow);font-weight:600">${AppleCharts.formatIDR(p.bonus)}</span>
                      <div style="font-size:10px;color:var(--text-tertiary)">${p.bonusLabel}</div>
                    </td>
                    <td style="font-size:14px;font-weight:700;color:var(--apple-green)">${AppleCharts.formatIDR(p.totalPay)}</td>
                    <td>
                      <span class="tier-badge" style="background:${p.status === 'Approved' ? 'rgba(48, 209, 88, 0.2)' : (p.status === 'Paid' ? 'rgba(0, 113, 227, 0.2)' : 'rgba(255, 159, 10, 0.2)')};color:${p.status === 'Approved' ? 'var(--apple-green)' : (p.status === 'Paid' ? 'var(--apple-cyan)' : 'var(--apple-orange)')}">
                        ${p.status}
                      </span>
                    </td>
                    <td>
                      <button class="apple-btn apple-btn-secondary" style="padding:3px 8px;font-size:11px" onclick="App.toggleHostPayrollStatus('${p.name}')">
                        ${p.status === 'Approved' ? 'Mark Paid' : (p.status === 'Paid' ? 'Reset' : 'Approve')}
                      </button>
                      <button class="apple-btn apple-btn-secondary" style="padding:3px 8px;font-size:11px" onclick="App.openPayrollSlipModal('${p.name}')">Slip</button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    },

    // 6. ASSESSMENT & SCORING ENGINE VIEW
    renderAssessmentView(container, data) {
      const { scoredHosts } = data;
      const weights = Scoring.weights;
      const currentAcc = Accounts.getCurrentAccount();
      const allReviews = Scoring.assessments;

      const myReviews = Scoring.getReviewsByReviewer(currentAcc.name);
      const myEvaluatedHostNames = new Set(myReviews.map(r => r.host.toLowerCase()));
      const totalHostsCount = scoredHosts.length;
      const evaluatedCount = myEvaluatedHostNames.size;
      const pendingCount = Math.max(0, totalHostsCount - evaluatedCount);

      let displayedReviews = allReviews;
      if (this.assessmentFilterReviewer !== 'all') {
        displayedReviews = allReviews.filter(r => r.reviewer.toLowerCase() === this.assessmentFilterReviewer.toLowerCase());
      }

      container.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <div>
            <h2 style="font-size:20px;font-weight:700">Multi-Reviewer Assessment & Scoring Engine</h2>
            <p style="font-size:12.5px;color:var(--text-tertiary)">Grade host performance, update previous evaluations, and configure scoring formulas</p>
          </div>
          <div style="display:flex;gap:10px;">
            <button class="apple-btn apple-btn-secondary" onclick="App.openAccountSwitcherModal()">Switch Evaluator (${currentAcc.name})</button>
            <button class="apple-btn apple-btn-primary" onclick="App.openAddReviewModal()">+ Grade Host</button>
          </div>
        </div>

        <div class="evaluator-progress-banner" style="margin-bottom:16px;">
          <div style="display:flex;align-items:center;gap:14px;">
            <div class="user-avatar" style="background:${currentAcc.avatarColor};width:44px;height:44px;font-size:16px;">
              ${currentAcc.initials}
            </div>
            <div>
              <div style="font-size:14.5px;font-weight:700;color:var(--text-primary)">
                Reviewer Active: ${currentAcc.name} (${currentAcc.role})
              </div>
              <div style="font-size:12px;color:var(--text-secondary);margin-top:2px;">
                You have submitted evaluations for <strong>${evaluatedCount} of ${totalHostsCount} creators</strong> (${pendingCount} pending your review).
              </div>
            </div>
          </div>
          <div style="display:flex;gap:8px;">
            <button class="apple-btn apple-btn-secondary" style="font-size:11.5px;padding:5px 12px;" onclick="App.filterReviewsByReviewer('${currentAcc.name}')">
              View My Evaluations (${myReviews.length})
            </button>
            <button class="apple-btn apple-btn-secondary" style="font-size:11.5px;padding:5px 12px;" onclick="App.filterReviewsByReviewer('all')">
              View All Reviews (${allReviews.length})
            </button>
          </div>
        </div>

        <div class="glass-card">
          <div class="card-header">
            <div class="card-title-group">
              <h3>Configurable Scoring Engine Weights</h3>
              <p>Drag sliders to dynamically rebalance team performance scoring</p>
            </div>
            <button class="apple-btn apple-btn-secondary" onclick="App.resetDefaultWeights()">Reset Defaults</button>
          </div>

          <div class="scoring-config-panel">
            <div class="slider-group">
              <h4 style="font-size:13px;font-weight:600;color:var(--apple-cyan)">Overall Weight Split</h4>
              <div class="slider-item">
                <div class="slider-item-header">
                  <span>Quantitative Performance</span>
                  <span id="label-w-perf">${weights.overall.performance}%</span>
                </div>
                <input type="range" min="10" max="90" value="${weights.overall.performance}" class="apple-slider" id="slider-w-perf" oninput="App.onWeightChange('overall', 'performance', this.value)" />
              </div>
              <div class="slider-item">
                <div class="slider-item-header">
                  <span>Qualitative Assessment</span>
                  <span id="label-w-assess">${weights.overall.assessment}%</span>
                </div>
                <input type="range" min="10" max="90" value="${weights.overall.assessment}" class="apple-slider" id="slider-w-assess" oninput="App.onWeightChange('overall', 'assessment', this.value)" />
              </div>
            </div>

            <div class="slider-group">
              <h4 style="font-size:13px;font-weight:600;color:var(--apple-purple)">Performance Metrics Weight</h4>
              <div class="slider-item">
                <div class="slider-item-header"><span>GMV Volume</span><span id="label-pw-gmv">${weights.performance.gmv}%</span></div>
                <input type="range" min="5" max="60" value="${weights.performance.gmv}" class="apple-slider" oninput="App.onWeightChange('performance', 'gmv', this.value)" />
              </div>
              <div class="slider-item">
                <div class="slider-item-header"><span>GMV / Hour Productivity</span><span id="label-pw-gmvhr">${weights.performance.gmv_hr}%</span></div>
                <input type="range" min="5" max="60" value="${weights.performance.gmv_hr}" class="apple-slider" oninput="App.onWeightChange('performance', 'gmv_hr', this.value)" />
              </div>
              <div class="slider-item">
                <div class="slider-item-header"><span>CTOR / Conversion</span><span id="label-pw-ctor">${weights.performance.ctor}%</span></div>
                <input type="range" min="5" max="60" value="${weights.performance.ctor}" class="apple-slider" oninput="App.onWeightChange('performance', 'ctor', this.value)" />
              </div>
            </div>

            <div class="slider-group">
              <h4 style="font-size:13px;font-weight:600;color:var(--apple-orange)">Qualitative Assessment Weight</h4>
              <div class="slider-item">
                <div class="slider-item-header"><span>Call To Action (CTA)</span><span id="label-aw-cta">${weights.assessment.cta}%</span></div>
                <input type="range" min="5" max="50" value="${weights.assessment.cta}" class="apple-slider" oninput="App.onWeightChange('assessment', 'cta', this.value)" />
              </div>
              <div class="slider-item">
                <div class="slider-item-header"><span>Product Pinning (Pin)</span><span id="label-aw-pin">${weights.assessment.pin}%</span></div>
                <input type="range" min="5" max="50" value="${weights.assessment.pin}" class="apple-slider" oninput="App.onWeightChange('assessment', 'pin', this.value)" />
              </div>
              <div class="slider-item">
                <div class="slider-item-header"><span>Discipline & Punctuality</span><span id="label-aw-disc">${weights.assessment.discipline}%</span></div>
                <input type="range" min="5" max="50" value="${weights.assessment.discipline}" class="apple-slider" oninput="App.onWeightChange('assessment', 'discipline', this.value)" />
              </div>
              <div class="slider-item">
                <div class="slider-item-header"><span>Grooming & Presentation</span><span id="label-aw-groom">${weights.assessment.grooming}%</span></div>
                <input type="range" min="5" max="50" value="${weights.assessment.grooming}" class="apple-slider" oninput="App.onWeightChange('assessment', 'grooming', this.value)" />
              </div>
            </div>
          </div>
        </div>

        <div class="glass-card">
          <div class="card-header">
            <div class="card-title-group">
              <h3>Raport Host - Unified Scoring Table</h3>
              <p>Combined performance & multi-reviewer evaluation results</p>
            </div>
          </div>

          <div class="table-responsive">
            <table class="apple-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Creator</th>
                  <th>Perf Score</th>
                  <th>CTA (1-5)</th>
                  <th>Pin (1-5)</th>
                  <th>Discipline (1-5)</th>
                  <th>Grooming (1-5)</th>
                  <th>Assess Score</th>
                  <th>Final Score</th>
                  <th>Evaluation Action</th>
                </tr>
              </thead>
              <tbody>
                ${scoredHosts.map(h => {
                  const myReview = Scoring.getHostReviewByReviewer(h.name, currentAcc.name);
                  return `
                    <tr onclick="App.openHostDrawer('${h.name}')" style="cursor:pointer">
                      <td><div class="rank-badge ${h.rank === 1 ? 'rank-1' : (h.rank === 2 ? 'rank-2' : (h.rank === 3 ? 'rank-3' : 'rank-other'))}">${h.rank}</div></td>
                      <td><strong>${h.name}</strong></td>
                      <td><span style="font-weight:600;color:var(--apple-cyan)">${h.perfScore.toFixed(1)}%</span></td>
                      <td>★ ${h.assessData.cta.toFixed(1)}</td>
                      <td>★ ${h.assessData.pin.toFixed(1)}</td>
                      <td>★ ${h.assessData.discipline.toFixed(1)}</td>
                      <td>★ ${h.assessData.grooming.toFixed(1)}</td>
                      <td><span style="font-weight:600;color:var(--apple-purple)">${h.assessScore.toFixed(1)}%</span></td>
                      <td style="font-size:15px;font-weight:700;color:var(--text-primary)">${h.finalScore.toFixed(1)}%</td>
                      <td onclick="event.stopPropagation()">
                        ${myReview ? `
                          <button class="apple-btn apple-btn-secondary" style="padding:3px 8px;font-size:11px;color:var(--apple-cyan)" onclick="App.openEditReviewModal('${myReview.id}')">
                            ✏️ Edit My Score (${myReview.cta.toFixed(1)})
                          </button>
                        ` : `
                          <button class="apple-btn apple-btn-primary" style="padding:3px 8px;font-size:11px" onclick="App.openAddReviewModal('${h.name}')">
                            ★ Grade Host
                          </button>
                        `}
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <div class="glass-card">
          <div class="card-header">
            <div class="card-title-group">
              <h3>Team Evaluation Records (${displayedReviews.length})</h3>
              <p>Individual ratings submitted by reviewers. Click Edit to adjust scores or notes.</p>
            </div>
            <div style="display:flex;align-items:center;gap:10px;">
              <label style="font-size:12px;color:var(--text-tertiary)">Filter Reviewer:</label>
              <select class="select-filter" onchange="App.filterReviewsByReviewer(this.value)">
                <option value="all" ${this.assessmentFilterReviewer === 'all' ? 'selected' : ''}>All Reviewers (${allReviews.length})</option>
                ${Accounts.getReviewerAccounts().map(a => `
                  <option value="${a.name}" ${this.assessmentFilterReviewer.toLowerCase() === a.name.toLowerCase() ? 'selected' : ''}>${a.name}</option>
                `).join('')}
              </select>
            </div>
          </div>

          <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(320px, 1fr));gap:14px;">
            ${displayedReviews.map(r => `
              <div class="review-card-item">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                  <div>
                    <div style="font-size:14px;font-weight:700;color:var(--text-primary)">Host: ${r.host}</div>
                    <div style="font-size:11px;color:var(--text-tertiary);margin-top:2px;">
                      By <strong>${r.reviewer}</strong> • ${r.date}
                    </div>
                  </div>
                  <div style="display:flex;gap:6px;">
                    <button class="review-action-btn" onclick="App.openEditReviewModal('${r.id}')" title="Edit this assessment">
                      ✏️ Edit
                    </button>
                    <button class="review-action-btn delete" onclick="App.deleteReview('${r.id}')" title="Delete this assessment">
                      ✕
                    </button>
                  </div>
                </div>

                <div style="display:grid;grid-template-columns:repeat(4, 1fr);gap:6px;background:rgba(255,255,255,0.02);padding:8px;border-radius:var(--radius-sm);text-align:center;">
                  <div><span style="font-size:10px;color:var(--text-tertiary)">CTA</span><div style="font-size:12.5px;font-weight:700;color:#ffd60a">★${r.cta}</div></div>
                  <div><span style="font-size:10px;color:var(--text-tertiary)">Pin</span><div style="font-size:12.5px;font-weight:700;color:#ffd60a">★${r.pin}</div></div>
                  <div><span style="font-size:10px;color:var(--text-tertiary)">Disc</span><div style="font-size:12.5px;font-weight:700;color:#ffd60a">★${r.discipline}</div></div>
                  <div><span style="font-size:10px;color:var(--text-tertiary)">Groom</span><div style="font-size:12.5px;font-weight:700;color:#ffd60a">★${r.grooming}</div></div>
                </div>

                <div style="font-size:11.5px;color:var(--text-secondary);font-style:italic;">
                  "${r.notes || 'No qualitative comment'}"
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    },

    filterReviewsByReviewer(reviewerName) {
      this.assessmentFilterReviewer = reviewerName;
      this.renderCurrentView();
    },

    onWeightChange(group, key, val) {
      val = parseInt(val, 10);
      if (group === 'overall') {
        Scoring.weights.overall.performance = val;
        Scoring.weights.overall.assessment = 100 - val;
        document.getElementById('label-w-perf').textContent = val + '%';
        document.getElementById('label-w-assess').textContent = (100 - val) + '%';
      } else {
        Scoring.weights[group][key] = val;
        const lbl = document.getElementById(`label-${group === 'performance' ? 'pw' : 'aw'}-${key}`);
        if (lbl) lbl.textContent = val + '%';
      }
      Scoring.saveWeights(Scoring.weights);
      this.renderCurrentView();
    },

    resetDefaultWeights() {
      Scoring.weights = {
        overall: { performance: 70, assessment: 30 },
        performance: { gmv: 30, gmv_hr: 25, ctor: 20, views: 15, sold_qty: 10 },
        assessment: { cta: 30, pin: 25, discipline: 25, grooming: 20 }
      };
      Scoring.saveWeights(Scoring.weights);
      this.renderCurrentView();
    },

    // 7. REPORTS VIEW
    renderReportsView(container, data) {
      const { kpis, scoredHosts } = data;

      container.innerHTML = `
        <div class="print-header">
          <h1>Livestream Performance Intelligence Executive Report</h1>
          <p>FYC Agency • Generated on ${new Date().toLocaleDateString('id-ID')}</p>
        </div>

        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <div>
            <h2 style="font-size:20px;font-weight:700">Executive Report Generator</h2>
            <p style="font-size:12.5px;color:var(--text-tertiary)">Print or download high-resolution intelligence summaries ready for leadership and brand partners</p>
          </div>
          <div style="display:flex;gap:10px;">
            <button class="apple-btn apple-btn-secondary" onclick="App.exportSessionsCSV()">Export Master CSV</button>
            <button class="apple-btn apple-btn-primary" onclick="window.print()">Print / Export PDF</button>
          </div>
        </div>

        <div class="glass-card">
          <div class="card-header">
            <div class="card-title-group">
              <h3>Executive Operational Summary</h3>
              <p>Consolidated results for July - September 2026</p>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:16px;padding-bottom:16px;">
            <div><span style="font-size:11px;color:var(--text-tertiary)">TOTAL GMV GENERATED</span><div style="font-size:22px;font-weight:700;color:var(--apple-cyan)">${AppleCharts.formatIDR(kpis.totalGMV)}</div></div>
            <div><span style="font-size:11px;color:var(--text-tertiary)">TOTAL BROADCAST TIME</span><div style="font-size:22px;font-weight:700">${kpis.totalDuration.toFixed(1)} Hours</div></div>
            <div><span style="font-size:11px;color:var(--text-tertiary)">AVERAGE PRODUCTIVITY</span><div style="font-size:22px;font-weight:700">${AppleCharts.formatIDR(kpis.avgGmvHour)}/hr</div></div>
            <div><span style="font-size:11px;color:var(--text-tertiary)">TOTAL UNITS SOLD</span><div style="font-size:22px;font-weight:700">${kpis.totalSold.toLocaleString()} pcs</div></div>
          </div>
        </div>

        <div class="glass-card">
          <div class="card-header">
            <div class="card-title-group">
              <h3>Creator Performance Ranking</h3>
              <p>Top performers evaluated against unified scoring matrix</p>
            </div>
          </div>
          <div class="table-responsive">
            <table class="apple-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Host</th>
                  <th>Tier</th>
                  <th>Total GMV</th>
                  <th>Hours</th>
                  <th>GMV/Hour</th>
                  <th>CTOR</th>
                  <th>Final Score</th>
                </tr>
              </thead>
              <tbody>
                ${scoredHosts.map(h => `
                  <tr>
                    <td>#${h.rank}</td>
                    <td><strong>${h.name}</strong></td>
                    <td><span class="tier-badge" style="background:${h.tierColor}25;color:${h.tierColor}">${h.tier}</span></td>
                    <td style="color:var(--apple-cyan);font-weight:600">${AppleCharts.formatIDR(h.gmv)}</td>
                    <td>${h.duration.toFixed(0)} hrs</td>
                    <td>${AppleCharts.formatIDR(h.gmvHour)}</td>
                    <td>${h.avgCtor.toFixed(1)}%</td>
                    <td><strong>${h.finalScore.toFixed(1)}%</strong></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    },

    // 8. ADMIN MANAGEMENT VIEW (RATES & SUB-ACCOUNTS)
    renderAdminView(container, data) {
      const { scoredHosts } = data;
      const currentAcc = Accounts.getCurrentAccount();
      const accounts = Accounts.getAccounts();
      const hostRates = Payroll.getAllHostRates();

      container.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <div>
            <h2 style="font-size:20px;font-weight:700">Admin Control Panel</h2>
            <p style="font-size:12.5px;color:var(--text-tertiary)">Manage creator hourly rates, sub-accounts, passwords/PINs, and cloud data portability</p>
          </div>
          <div style="display:flex;gap:10px;">
            <button class="apple-btn apple-btn-secondary" onclick="App.exportFullBackupJSON()">Download Data Backup</button>
            <button class="apple-btn apple-btn-primary" onclick="App.openAddAccountModal()">+ New Sub-Account</button>
          </div>
        </div>

        <!-- Admin Navigation Tabs -->
        <div class="admin-tabs">
          <button class="admin-tab-btn ${this.adminActiveTab === 'host-rates' ? 'active' : ''}" onclick="App.setAdminTab('host-rates')">Host Rate Cards (${hostRates.length})</button>
          <button class="admin-tab-btn ${this.adminActiveTab === 'sub-accounts' ? 'active' : ''}" onclick="App.setAdminTab('sub-accounts')">Sub-Accounts & PINs (${accounts.length})</button>
          <button class="admin-tab-btn ${this.adminActiveTab === 'cloud-sync' ? 'active' : ''}" onclick="App.setAdminTab('cloud-sync')">Cloud & Storage Info</button>
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
            <table class="apple-table">
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
                        <div style="display:flex;align-items:center;gap:10px;">
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
                        <button class="apple-btn apple-btn-secondary" style="padding:4px 10px;font-size:11.5px" onclick="App.openAdjustRateModal('${h.name}')">
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
            <button class="apple-btn apple-btn-primary" onclick="App.openAddAccountModal()">+ Add Sub-Account</button>
          </div>

          <div class="table-responsive">
            <table class="apple-table">
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
                      <div style="display:flex;align-items:center;gap:10px;">
                        <div class="user-avatar" style="background:${acc.avatarColor || '#0071e3'};width:32px;height:32px;font-size:12px;">
                          ${acc.initials}
                        </div>
                        <div>
                          <strong>${acc.name}</strong>
                          <div style="font-size:11px;color:var(--text-tertiary)">${acc.description || ''}</div>
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
                        <button class="apple-btn apple-btn-secondary" style="padding:3px 8px;font-size:11px" onclick="App.openEditAccountModal('${acc.id}')">
                          ✏️ Edit
                        </button>
                        ${acc.id !== 'acc_afiq' ? `
                          <button class="review-action-btn delete" onclick="App.deleteAccount('${acc.id}')" title="Delete Account">
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

            <div style="display:flex;flex-direction:column;gap:14px;">
              <div>
                <label style="display:block;font-size:12px;color:var(--text-secondary);margin-bottom:4px;">Supabase Project URL</label>
                <input type="text" id="supabase-url" value="${window.SupabaseEngine.url || ''}" placeholder="https://your-project-ref.supabase.co" class="select-filter" style="width:100%;font-family:monospace" />
                <span style="font-size:11px;color:var(--text-tertiary);margin-top:3px;display:block;">Found in Supabase Dashboard > Project Settings > API > Project URL</span>
              </div>

              <div>
                <label style="display:block;font-size:12px;color:var(--text-secondary);margin-bottom:4px;">Supabase Project API Key (anon public key)</label>
                <input type="password" id="supabase-anon-key" value="${window.SupabaseEngine.anonKey || ''}" placeholder="eyJhbGciOi..." class="select-filter" style="width:100%;font-family:monospace" />
                <span style="font-size:11px;color:var(--text-tertiary);margin-top:3px;display:block;">Found in Supabase Dashboard > Project Settings > API > anon public key (safe for client apps)</span>
              </div>

              <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:8px;">
                <button class="apple-btn apple-btn-primary" onclick="App.connectSupabase()">Save & Test Connection</button>
                ${isConnected ? `
                  <button class="apple-btn apple-btn-secondary" onclick="App.pullSupabaseData()">⬇️ Pull Latest from Cloud</button>
                  <button class="apple-btn apple-btn-secondary" onclick="App.pushSupabaseData()">⬆️ Push Local to Cloud</button>
                  <button class="apple-btn apple-btn-secondary" style="color:var(--apple-red)" onclick="App.disconnectSupabase()">Disconnect</button>
                ` : ''}
              </div>

              ${isConnected ? `
                <div style="font-size:11.5px;color:var(--text-tertiary);margin-top:4px;">
                  Last synchronized with Supabase: <strong>${lastSync}</strong>
                </div>
              ` : ''}
            </div>
          </div>

          <!-- Setup SQL Schema Script -->
          <div class="glass-card">
            <div class="card-header">
              <div class="card-title-group">
                <h3>📋 1-Click Database Setup (SQL Schema)</h3>
                <p>Run this script once in Supabase (SQL Editor > New Query > Run) to create tables automatically</p>
              </div>
              <button class="apple-btn apple-btn-secondary" onclick="App.copySQLSchema()">Copy SQL Script</button>
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

            <div style="display:flex;gap:10px;">
              <button class="apple-btn apple-btn-secondary" onclick="App.exportFullBackupJSON()">Download Complete Backup JSON</button>
              <button class="apple-btn apple-btn-secondary" onclick="App.openImportBackupModal()">Restore Backup JSON</button>
            </div>
          </div>
        </div>
      `;
    },

    async connectSupabase() {
      const url = document.getElementById('supabase-url').value.trim();
      const key = document.getElementById('supabase-anon-key').value.trim();

      if (!url || !key) {
        alert('Please enter both Supabase Project URL and Anon Public Key.');
        return;
      }

      window.SupabaseEngine.saveConfig(url, key);
      const res = await window.SupabaseEngine.testConnection();
      if (res.success) {
        alert('SUCCESS: Connected to Supabase Cloud Database! Syncing data now...');
        await window.SupabaseEngine.syncDown();
        this.renderCurrentView();
      } else {
        alert('CONNECTION NOTICE: ' + res.message);
        this.renderCurrentView();
      }
    },

    async pullSupabaseData() {
      const ok = await window.SupabaseEngine.syncDown();
      if (ok) {
        alert('Successfully pulled latest sub-accounts, assessments, and rates from Supabase Cloud!');
        this.renderCurrentView();
      } else {
        alert('Failed to pull from Supabase. Check internet connection and API keys.');
      }
    },

    async pushSupabaseData() {
      const res = await window.SupabaseEngine.syncUp();
      alert(res.message);
      this.renderCurrentView();
    },

    disconnectSupabase() {
      if (confirm('Disconnect from Supabase? The platform will return to LocalStorage mode.')) {
        window.SupabaseEngine.disconnect();
        alert('Disconnected from Supabase.');
        this.renderCurrentView();
      }
    },

    copySQLSchema() {
      const sql = window.SupabaseEngine.getSQLSchemaScript();
      navigator.clipboard.writeText(sql).then(() => {
        alert('SQL Schema copied to clipboard! Paste it into Supabase SQL Editor and click Run.');
      }).catch(() => {
        alert('Please select and copy the SQL code manually.');
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
        <p style="font-size:12px;color:var(--text-tertiary);margin-bottom:16px;">Upload a previously downloaded JSON backup file to restore sub-accounts and rates</p>
        <input type="file" id="backup-file-input" accept=".json" class="select-filter" style="width:100%" />
        <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:16px;">
          <button class="apple-btn apple-btn-secondary" onclick="App.closeModal()">Cancel</button>
          <button class="apple-btn apple-btn-primary" id="btn-process-backup">Restore Data</button>
        </div>
      `;

      document.getElementById('btn-process-backup').onclick = () => {
        const fileInput = document.getElementById('backup-file-input');
        if (!fileInput.files || fileInput.files.length === 0) {
          alert('Please choose a backup JSON file first.');
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

            alert('Backup restored successfully! Reloading...');
            location.reload();
          } catch (err) {
            alert('Invalid backup JSON format: ' + err.message);
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
          <h2 style="font-size:20px;font-weight:700">Platform Settings & Data Connection</h2>
          <p style="font-size:12.5px;color:var(--text-tertiary)">Manage master spreadsheet bindings, sync intervals, and sub-accounts</p>
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
              <input type="text" id="setting-sheet-id" value="${SyncEngine.sheetId}" class="select-filter" style="width:100%;font-family:monospace" />
            </div>
            <div>
              <label style="display:block;font-size:12px;color:var(--text-secondary);margin-bottom:6px">Target Sheet Name</label>
              <input type="text" id="setting-sheet-name" value="${SyncEngine.sheetName}" class="select-filter" style="width:100%" />
            </div>

            <div style="display:flex;gap:10px;margin-top:8px;">
              <button class="apple-btn apple-btn-primary" onclick="App.saveSheetSettings()">Save Configuration</button>
              <button class="apple-btn apple-btn-secondary" onclick="App.triggerSync()">Sync Now from Google Sheet</button>
            </div>

            <div style="padding:14px;background:rgba(255,255,255,0.03);border-radius:var(--radius-sm);border:1px solid var(--border-subtle);margin-top:12px;">
              <h4 style="font-size:13px;font-weight:600;margin-bottom:4px">Upload / Update via Drag & Drop</h4>
              <p style="font-size:12px;color:var(--text-tertiary);line-height:1.5">
                Whenever your Google Sheet updates, you can also download the "Report" tab as CSV and drag & drop it directly into the dashboard. It will instantly re-process all calculations.
              </p>
              <button class="apple-btn apple-btn-secondary" style="margin-top:10px;" onclick="App.openSyncModal()">Open Drag & Drop Uploader</button>
            </div>
          </div>
        </div>
      `;
    },

    saveSheetSettings() {
      const id = document.getElementById('setting-sheet-id').value.trim();
      const name = document.getElementById('setting-sheet-name').value.trim();
      SyncEngine.saveConfig(id, name);
      alert('Google Sheet settings saved successfully!');
    },

    async triggerSync() {
      const res = await SyncEngine.syncFromGoogleSheet();
      if (res.success) {
        alert(`Sync successful! Updated ${res.count} sessions from Google Sheets.`);
        this.renderCurrentView();
      } else {
        alert(res.message);
      }
    },

    // --- HOST DETAIL DRAWER ---
    openHostDrawer(hostName) {
      this.selectedHostForDrawer = hostName;
      const drawer = document.getElementById('host-detail-drawer');
      if (!drawer) return;

      const allAggs = Analytics.getHostAggregates(Analytics.getFilteredSessions());
      const scored = Scoring.computeAllHostScores(allAggs).find(h => h.name.toLowerCase() === hostName.toLowerCase());
      const rateHistory = Payroll.getHostRateHistory(hostName);
      const reviews = Scoring.getHostReviews(hostName);
      const currentRate = Payroll.getHostRate(hostName);

      const content = document.getElementById('drawer-content-area');
      if (!content || !scored) return;

      content.innerHTML = `
        <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px;">
          <div class="host-avatar" style="width:60px;height:60px;font-size:22px;background:${scored.tierColor}">
            ${scored.name.substring(0, 2).toUpperCase()}
          </div>
          <div>
            <h2 style="font-size:22px;font-weight:700">${scored.name}</h2>
            <div style="display:flex;gap:8px;margin-top:4px;">
              <span class="tier-badge" style="background:${scored.tierColor}25;color:${scored.tierColor}">${scored.tier} (Rank #${scored.rank})</span>
              <span class="tier-badge" style="background:rgba(255,255,255,0.08);color:var(--text-secondary)">Rate: ${AppleCharts.formatIDR(currentRate)}/hr</span>
            </div>
          </div>
        </div>

        <div class="host-stats-row" style="margin-bottom:20px;">
          <div class="host-stat-box"><div class="title">Total GMV</div><div class="val" style="color:var(--apple-cyan)">${AppleCharts.formatIDRShort(scored.gmv)}</div></div>
          <div class="host-stat-box"><div class="title">Live Hours</div><div class="val">${scored.duration.toFixed(0)}h</div></div>
          <div class="host-stat-box"><div class="title">GMV/Hour</div><div class="val">${AppleCharts.formatIDRShort(scored.gmvHour)}</div></div>
        </div>

        <div class="glass-card" style="margin-bottom:20px;padding:16px;">
          <h4 style="font-size:13px;font-weight:600;margin-bottom:8px;">Evaluation Radar</h4>
          <canvas id="hostRadarCanvas" style="width:100%;height:200px;display:block"></canvas>
        </div>

        <div class="glass-card" style="margin-bottom:20px;padding:16px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
            <h4 style="font-size:13px;font-weight:600;">Supervisor Assessments (${reviews.length})</h4>
            <button class="apple-btn apple-btn-secondary" style="padding:2px 8px;font-size:10px" onclick="App.openAddReviewModal('${scored.name}')">+ Grade Host</button>
          </div>
          <div style="display:flex;flex-direction:column;gap:10px;">
            ${reviews.length > 0 ? reviews.map(r => `
              <div style="padding:12px;background:rgba(255,255,255,0.03);border-radius:var(--radius-sm);border:1px solid var(--border-subtle)">
                <div style="display:flex;justify-content:space-between;align-items:center;font-size:12px;font-weight:600;">
                  <span>👤 ${r.reviewer}</span>
                  <div style="display:flex;align-items:center;gap:6px;">
                    <span style="font-size:11px;color:var(--text-tertiary);margin-right:4px;">${r.date}</span>
                    <button class="review-action-btn" onclick="App.openEditReviewModal('${r.id}')" title="Edit this assessment">✏️ Edit</button>
                    <button class="review-action-btn delete" onclick="App.deleteReview('${r.id}')" title="Delete this assessment">✕</button>
                  </div>
                </div>
                <div style="font-size:11.5px;color:var(--apple-yellow);margin:6px 0;">
                  CTA: ★${r.cta} • Pin: ★${r.pin} • Discipline: ★${r.discipline} • Grooming: ★${r.grooming}
                </div>
                <div style="font-size:11.5px;color:var(--text-secondary);font-style:italic">"${r.notes || 'No notes provided'}"</div>
              </div>
            `).join('') : '<div style="font-size:12px;color:var(--text-tertiary);text-align:center;padding:12px 0;">No supervisor reviews recorded yet.</div>'}
          </div>
        </div>

        <div class="glass-card" style="padding:16px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
            <h4 style="font-size:13px;font-weight:600;">Hourly Rate History</h4>
            <button class="apple-btn apple-btn-secondary" style="padding:2px 8px;font-size:10px" onclick="App.openAdjustRateModal('${scored.name}')">Adjust Rate</button>
          </div>
          <div style="display:flex;flex-direction:column;gap:8px;">
            ${rateHistory.length > 0 ? rateHistory.map(h => `
              <div style="display:flex;justify-content:space-between;font-size:11.5px;padding:6px 0;border-bottom:1px solid var(--border-subtle)">
                <span>${h.date}: ${AppleCharts.formatIDR(h.old_rate)} → <strong>${AppleCharts.formatIDR(h.new_rate)}</strong></span>
                <span style="color:var(--text-tertiary)">${h.reason}</span>
              </div>
            `).join('') : '<div style="font-size:11.5px;color:var(--text-tertiary)">No prior rate adjustments recorded.</div>'}
          </div>
        </div>
      `;

      drawer.classList.add('active');

      setTimeout(() => {
        const radarCanvas = document.getElementById('hostRadarCanvas');
        if (radarCanvas) {
          AppleCharts.drawRadarChart(radarCanvas, {
            labels: ['CTA', 'Pin', 'Discipline', 'Grooming', 'Performance'],
            values: [
              scored.assessData.cta,
              scored.assessData.pin,
              scored.assessData.discipline,
              scored.assessData.grooming,
              (scored.perfScore / 20)
            ]
          });
        }
      }, 50);
    },

    closeHostDrawer() {
      const drawer = document.getElementById('host-detail-drawer');
      if (drawer) drawer.classList.remove('active');
      this.selectedHostForDrawer = null;
    },

    // --- MODAL: ADD / EDIT ASSESSMENTS ---
    openAddReviewModal(preselectedHost = '') {
      const modal = document.getElementById('generic-modal');
      const container = document.getElementById('modal-inner-content');
      if (!modal || !container) return;

      const hosts = window.MASTER_HOST_PROFILES || [];
      const reviewerAccounts = Accounts.getReviewerAccounts();
      const currentAcc = Accounts.getCurrentAccount();

      let existingReview = null;
      if (preselectedHost) {
        existingReview = Scoring.getHostReviewByReviewer(preselectedHost, currentAcc.name);
      }

      container.innerHTML = `
        <h3 style="font-size:18px;font-weight:700;margin-bottom:6px;">
          ${existingReview ? 'Update Assessment for ' + preselectedHost : 'Submit Reviewer Assessment'}
        </h3>
        <p style="font-size:12px;color:var(--text-tertiary);margin-bottom:16px;">
          Scale 1.0 (Low) to 5.0 (Exceptional). Scoring will automatically average across all reviewers.
        </p>
        <form id="add-review-form" style="display:flex;flex-direction:column;gap:14px;">
          <div>
            <label style="font-size:12px;color:var(--text-secondary);display:block;margin-bottom:4px;">Select Creator</label>
            <select id="rev-host-select" class="select-filter" style="width:100%" onchange="App.onReviewHostChange(this.value)">
              ${hosts.map(h => `<option value="${h.name}" ${h.name.toLowerCase() === preselectedHost.toLowerCase() ? 'selected' : ''}>${h.name}</option>`).join('')}
            </select>
          </div>

          <div>
            <label style="font-size:12px;color:var(--text-secondary);display:block;margin-bottom:4px;">Reviewer (Logged In Account)</label>
            <select id="rev-reviewer-select" class="select-filter" style="width:100%">
              ${reviewerAccounts.map(r => `<option value="${r.name}" ${r.name.toLowerCase() === currentAcc.name.toLowerCase() ? 'selected' : ''}>${r.name} (${r.role})</option>`).join('')}
            </select>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
            <div>
              <div style="display:flex;justify-content:space-between;font-size:11.5px;color:var(--text-secondary);margin-bottom:4px;">
                <span>Call To Action (CTA)</span>
                <strong id="val-preview-cta">${existingReview ? existingReview.cta : '4.8'}</strong>
              </div>
              <input type="range" id="rev-cta" min="1.0" max="5.0" step="0.1" value="${existingReview ? existingReview.cta : '4.8'}" class="apple-slider" oninput="document.getElementById('val-preview-cta').textContent=this.value" />
            </div>
            <div>
              <div style="display:flex;justify-content:space-between;font-size:11.5px;color:var(--text-secondary);margin-bottom:4px;">
                <span>Product Pinning (Pin)</span>
                <strong id="val-preview-pin">${existingReview ? existingReview.pin : '4.7'}</strong>
              </div>
              <input type="range" id="rev-pin" min="1.0" max="5.0" step="0.1" value="${existingReview ? existingReview.pin : '4.7'}" class="apple-slider" oninput="document.getElementById('val-preview-pin').textContent=this.value" />
            </div>
            <div>
              <div style="display:flex;justify-content:space-between;font-size:11.5px;color:var(--text-secondary);margin-bottom:4px;">
                <span>Discipline & Punctuality</span>
                <strong id="val-preview-disc">${existingReview ? existingReview.discipline : '5.0'}</strong>
              </div>
              <input type="range" id="rev-disc" min="1.0" max="5.0" step="0.1" value="${existingReview ? existingReview.discipline : '5.0'}" class="apple-slider" oninput="document.getElementById('val-preview-disc').textContent=this.value" />
            </div>
            <div>
              <div style="display:flex;justify-content:space-between;font-size:11.5px;color:var(--text-secondary);margin-bottom:4px;">
                <span>Grooming & Presentation</span>
                <strong id="val-preview-groom">${existingReview ? existingReview.grooming : '4.9'}</strong>
              </div>
              <input type="range" id="rev-groom" min="1.0" max="5.0" step="0.1" value="${existingReview ? existingReview.grooming : '4.9'}" class="apple-slider" oninput="document.getElementById('val-preview-groom').textContent=this.value" />
            </div>
          </div>

          <div>
            <label style="font-size:12px;color:var(--text-secondary);display:block;margin-bottom:4px;">Reviewer Notes & Feedback</label>
            <textarea id="rev-notes" rows="3" class="select-filter" style="width:100%;resize:vertical" placeholder="Enter qualitative observations, strengths, or areas for improvement...">${existingReview ? (existingReview.notes || '') : ''}</textarea>
          </div>

          <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:8px;">
            <button type="button" class="apple-btn apple-btn-secondary" onclick="App.closeModal()">Cancel</button>
            <button type="submit" class="apple-btn apple-btn-primary">Save Assessment</button>
          </div>
        </form>
      `;

      document.getElementById('add-review-form').onsubmit = (e) => {
        e.preventDefault();
        const host = document.getElementById('rev-host-select').value;
        const reviewer = document.getElementById('rev-reviewer-select').value;
        const cta = parseFloat(document.getElementById('rev-cta').value);
        const pin = parseFloat(document.getElementById('rev-pin').value);
        const discipline = parseFloat(document.getElementById('rev-disc').value);
        const grooming = parseFloat(document.getElementById('rev-groom').value);
        const notes = document.getElementById('rev-notes').value || 'Good overall performance.';

        Scoring.addAssessment({ host, reviewer, cta, pin, discipline, grooming, notes });
        this.closeModal();
        this.renderCurrentView();
        if (this.selectedHostForDrawer) this.openHostDrawer(this.selectedHostForDrawer);
      };

      modal.classList.add('active');
    },

    onReviewHostChange(hostName) {
      const reviewer = document.getElementById('rev-reviewer-select').value;
      const existing = Scoring.getHostReviewByReviewer(hostName, reviewer);
      if (existing) {
        document.getElementById('rev-cta').value = existing.cta;
        document.getElementById('val-preview-cta').textContent = existing.cta;
        document.getElementById('rev-pin').value = existing.pin;
        document.getElementById('val-preview-pin').textContent = existing.pin;
        document.getElementById('rev-disc').value = existing.discipline;
        document.getElementById('val-preview-disc').textContent = existing.discipline;
        document.getElementById('rev-groom').value = existing.grooming;
        document.getElementById('val-preview-groom').textContent = existing.grooming;
        document.getElementById('rev-notes').value = existing.notes || '';
      }
    },

    openEditReviewModal(reviewId) {
      const review = Scoring.getAssessmentById(reviewId);
      if (!review) {
        alert('Review record not found.');
        return;
      }

      const modal = document.getElementById('generic-modal');
      const container = document.getElementById('modal-inner-content');
      if (!modal || !container) return;

      container.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <h3 style="font-size:18px;font-weight:700">Edit Assessment: ${review.host}</h3>
          <button class="review-action-btn delete" onclick="App.deleteReview('${review.id}')" title="Delete Review">Delete Review</button>
        </div>
        <p style="font-size:12px;color:var(--text-tertiary);margin-bottom:16px;">
          Reviewed by <strong>${review.reviewer}</strong> on ${review.date}
        </p>

        <form id="edit-review-form" style="display:flex;flex-direction:column;gap:14px;">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
            <div>
              <div style="display:flex;justify-content:space-between;font-size:11.5px;color:var(--text-secondary);margin-bottom:4px;">
                <span>Call To Action (CTA)</span>
                <strong id="edit-val-cta">${review.cta}</strong>
              </div>
              <input type="range" id="edit-cta" min="1.0" max="5.0" step="0.1" value="${review.cta}" class="apple-slider" oninput="document.getElementById('edit-val-cta').textContent=this.value" />
            </div>

            <div>
              <div style="display:flex;justify-content:space-between;font-size:11.5px;color:var(--text-secondary);margin-bottom:4px;">
                <span>Product Pinning (Pin)</span>
                <strong id="edit-val-pin">${review.pin}</strong>
              </div>
              <input type="range" id="edit-pin" min="1.0" max="5.0" step="0.1" value="${review.pin}" class="apple-slider" oninput="document.getElementById('edit-val-pin').textContent=this.value" />
            </div>

            <div>
              <div style="display:flex;justify-content:space-between;font-size:11.5px;color:var(--text-secondary);margin-bottom:4px;">
                <span>Discipline & Punctuality</span>
                <strong id="edit-val-disc">${review.discipline}</strong>
              </div>
              <input type="range" id="edit-disc" min="1.0" max="5.0" step="0.1" value="${review.discipline}" class="apple-slider" oninput="document.getElementById('edit-val-disc').textContent=this.value" />
            </div>

            <div>
              <div style="display:flex;justify-content:space-between;font-size:11.5px;color:var(--text-secondary);margin-bottom:4px;">
                <span>Grooming & Presentation</span>
                <strong id="edit-val-groom">${review.grooming}</strong>
              </div>
              <input type="range" id="edit-groom" min="1.0" max="5.0" step="0.1" value="${review.grooming}" class="apple-slider" oninput="document.getElementById('edit-val-groom').textContent=this.value" />
            </div>
          </div>

          <div>
            <label style="font-size:12px;color:var(--text-secondary);display:block;margin-bottom:4px;">Reviewer Notes & Feedback</label>
            <textarea id="edit-notes" rows="3" class="select-filter" style="width:100%;resize:vertical" placeholder="Enter qualitative notes...">${review.notes || ''}</textarea>
          </div>

          <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:8px;">
            <button type="button" class="apple-btn apple-btn-secondary" onclick="App.closeModal()">Cancel</button>
            <button type="submit" class="apple-btn apple-btn-primary">Update Assessment</button>
          </div>
        </form>
      `;

      document.getElementById('edit-review-form').onsubmit = (e) => {
        e.preventDefault();
        const cta = parseFloat(document.getElementById('edit-cta').value);
        const pin = parseFloat(document.getElementById('edit-pin').value);
        const discipline = parseFloat(document.getElementById('edit-disc').value);
        const grooming = parseFloat(document.getElementById('edit-groom').value);
        const notes = document.getElementById('edit-notes').value;

        Scoring.updateAssessment(reviewId, { cta, pin, discipline, grooming, notes });
        this.closeModal();
        this.renderCurrentView();
        if (this.selectedHostForDrawer) {
          this.openHostDrawer(this.selectedHostForDrawer);
        }
      };

      modal.classList.add('active');
    },

    deleteReview(reviewId) {
      if (confirm('Are you sure you want to delete this assessment?')) {
        Scoring.deleteAssessment(reviewId);
        this.closeModal();
        this.renderCurrentView();
        if (this.selectedHostForDrawer) {
          this.openHostDrawer(this.selectedHostForDrawer);
        }
      }
    },

    // --- OTHER MODALS ---
    openAdjustRateModal(hostName) {
      const modal = document.getElementById('generic-modal');
      const container = document.getElementById('modal-inner-content');
      if (!modal || !container) return;

      const currentRate = Payroll.getHostRate(hostName);
      const currentAcc = Accounts.getCurrentAccount();

      container.innerHTML = `
        <h3 style="font-size:18px;font-weight:700;margin-bottom:16px;">Adjust Hourly Rate: ${hostName}</h3>
        <form id="adjust-rate-form" style="display:flex;flex-direction:column;gap:14px;">
          <div>
            <label style="font-size:12px;color:var(--text-secondary);display:block;margin-bottom:4px;">New Hourly Rate (IDR)</label>
            <input type="number" id="new-rate-input" value="${currentRate}" step="5000" class="select-filter" style="width:100%" />
          </div>
          <div>
            <label style="font-size:12px;color:var(--text-secondary);display:block;margin-bottom:4px;">Reason for Adjustment</label>
            <input type="text" id="rate-reason-input" value="Performance promotion" class="select-filter" style="width:100%" />
          </div>
          <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:8px;">
            <button type="button" class="apple-btn apple-btn-secondary" onclick="App.closeModal()">Cancel</button>
            <button type="submit" class="apple-btn apple-btn-primary">Update Rate</button>
          </div>
        </form>
      `;

      document.getElementById('adjust-rate-form').onsubmit = (e) => {
        e.preventDefault();
        const r = parseInt(document.getElementById('new-rate-input').value, 10);
        const reason = document.getElementById('rate-reason-input').value;
        Payroll.setHostRate(hostName, r, reason, currentAcc.name);
        this.closeModal();
        this.renderCurrentView();
        if (this.selectedHostForDrawer) this.openHostDrawer(this.selectedHostForDrawer);
      };

      modal.classList.add('active');
    },

    openPayrollSlipModal(hostName) {
      const modal = document.getElementById('generic-modal');
      const container = document.getElementById('modal-inner-content');
      if (!modal || !container) return;

      const hostAggs = Analytics.getHostAggregates(Analytics.getFilteredSessions());
      const summary = Payroll.calculatePayrollSummary(hostAggs, '2026-09');
      const item = summary.items.find(i => i.name.toLowerCase() === hostName.toLowerCase());
      if (!item) return;

      container.innerHTML = `
        <div style="padding:10px;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:1px solid var(--border-subtle);padding-bottom:16px;margin-bottom:16px;">
            <div>
              <h2 style="font-size:18px;font-weight:700">CREATOR PAYROLL SLIP</h2>
              <p style="font-size:11.5px;color:var(--text-tertiary)">FYC Agency Livestreaming Operations</p>
            </div>
            <div style="text-align:right">
              <div style="font-size:12px;font-weight:600">Period: Sep 2026</div>
              <div style="font-size:11px;color:var(--text-tertiary)">Issued: ${new Date().toLocaleDateString('id-ID')}</div>
            </div>
          </div>

          <div style="margin-bottom:16px;">
            <div style="font-size:14px;font-weight:700">${item.name}</div>
            <div style="font-size:12px;color:var(--text-secondary)">Total Shifts: ${item.sessions} | Approved Hours: ${item.hours.toFixed(1)}h</div>
          </div>

          <div style="background:rgba(255,255,255,0.03);border-radius:var(--radius-sm);padding:14px;display:flex;flex-direction:column;gap:8px;margin-bottom:16px;">
            <div style="display:flex;justify-content:space-between;font-size:12.5px;">
              <span>Base Pay (${item.hours.toFixed(1)}h × ${AppleCharts.formatIDR(item.rate)}):</span>
              <span>${AppleCharts.formatIDR(item.basePay)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:12.5px;color:var(--apple-yellow)">
              <span>Performance Bonus (${item.bonusLabel}):</span>
              <span>+ ${AppleCharts.formatIDR(item.bonus)}</span>
            </div>
            <div style="border-top:1px solid var(--border-subtle);padding-top:8px;display:flex;justify-content:space-between;font-size:15px;font-weight:700;color:var(--apple-green)">
              <span>Total Payout:</span>
              <span>${AppleCharts.formatIDR(item.totalPay)}</span>
            </div>
          </div>

          <div style="display:flex;justify-content:flex-end;gap:10px;">
            <button class="apple-btn apple-btn-secondary" onclick="App.closeModal()">Close</button>
            <button class="apple-btn apple-btn-primary" onclick="window.print()">Print Slip</button>
          </div>
        </div>
      `;

      modal.classList.add('active');
    },

    toggleHostPayrollStatus(hostName) {
      const cur = Payroll.getStatus(hostName, '2026-09');
      let next = 'Approved';
      if (cur === 'Pending') next = 'Approved';
      else if (cur === 'Approved') next = 'Paid';
      else next = 'Pending';

      Payroll.setStatus(hostName, '2026-09', next);
      this.renderCurrentView();
    },

    approveAllPayroll() {
      const hostAggs = Analytics.getHostAggregates(Analytics.getFilteredSessions());
      hostAggs.forEach(h => {
        Payroll.setStatus(h.name, '2026-09', 'Approved');
      });
      this.renderCurrentView();
    },

    openSyncModal() {
      const modal = document.getElementById('generic-modal');
      const container = document.getElementById('modal-inner-content');
      if (!modal || !container) return;

      container.innerHTML = `
        <h3 style="font-size:18px;font-weight:700;margin-bottom:8px;">Data Synchronization & Import</h3>
        <p style="font-size:12.5px;color:var(--text-tertiary);margin-bottom:16px;">
          Synchronize master data directly from Google Sheets or drag and drop an updated CSV file.
        </p>

        <div id="drop-zone" style="border:2px dashed var(--border-subtle);border-radius:var(--radius-md);padding:32px;text-align:center;cursor:pointer;transition:var(--transition-apple);background:rgba(255,255,255,0.02)">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="color:var(--apple-cyan);margin-bottom:8px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          <div style="font-size:14px;font-weight:600">Drag & Drop updated Report CSV here</div>
          <div style="font-size:11.5px;color:var(--text-tertiary);margin-top:4px">or click to browse from computer</div>
          <input type="file" id="file-input" accept=".csv" style="display:none" />
        </div>

        <div style="display:flex;align-items:center;gap:12px;margin:20px 0;">
          <div style="flex:1;height:1px;background:var(--border-subtle)"></div>
          <span style="font-size:11px;color:var(--text-tertiary);text-transform:uppercase">OR SYNC DIRECTLY</span>
          <div style="flex:1;height:1px;background:var(--border-subtle)"></div>
        </div>

        <div style="display:flex;flex-direction:column;gap:10px;">
          <button class="apple-btn apple-btn-primary" style="justify-content:center;padding:10px" onclick="App.triggerSync()">
            Sync from Google Sheet (${SyncEngine.sheetId.substring(0, 10)}...)
          </button>
          <button class="apple-btn apple-btn-secondary" style="justify-content:center;padding:10px" onclick="App.closeModal()">
            Done
          </button>
        </div>
      `;

      const dropZone = document.getElementById('drop-zone');
      const fileInput = document.getElementById('file-input');

      dropZone.onclick = () => fileInput.click();
      dropZone.ondragover = (e) => { e.preventDefault(); dropZone.style.borderColor = 'var(--apple-blue)'; };
      dropZone.ondragleave = () => { dropZone.style.borderColor = 'var(--border-subtle)'; };
      dropZone.ondrop = (e) => {
        e.preventDefault();
        dropZone.style.borderColor = 'var(--border-subtle)';
        if (e.dataTransfer.files.length > 0) this.handleCSVFile(e.dataTransfer.files[0]);
      };
      fileInput.onchange = (e) => {
        if (e.target.files.length > 0) this.handleCSVFile(e.target.files[0]);
      };

      modal.classList.add('active');
    },

    handleCSVFile(file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target.result;
        const sessions = SyncEngine.parseCSVToSessions(text);
        if (sessions.length > 0) {
          window.MASTER_SESSIONS = sessions;
          localStorage.setItem('fyc_custom_sessions', JSON.stringify(sessions));
          SyncEngine.updateSyncUI('success', `Imported (${sessions.length.toLocaleString()} sessions)`);
          alert(`Successfully imported ${sessions.length} sessions from ${file.name}!`);
          this.closeModal();
          this.renderCurrentView();
        } else {
          alert('Failed to parse sessions. Please check the CSV format.');
        }
      };
      reader.readAsText(file);
    },

    closeModal() {
      const modal = document.getElementById('generic-modal');
      if (modal) modal.classList.remove('active');
    },

    exportSessionsCSV() {
      const sessions = Analytics.getFilteredSessions();
      let csv = 'Date,Brand,Platform,Host,Start,End,Duration,GMV,GMV_Hour,Product,CTR,CTOR,Ads_Cost,Views,Followers,Sold_Qty,Buyer\n';
      sessions.forEach(s => {
        csv += `"${s.date}","${s.brand}","${s.platform}","${s.host}","${s.start}","${s.end}",${s.duration},${s.gmv},${s.gmv_hr},"${(s.product||'').replace(/"/g, '""')}",${s.ctr},${s.ctor},${s.ads_cost},${s.views},${s.followers},${s.sold_qty},${s.buyer}
`;
      });

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `livestream_sessions_export_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
    },

    exportPayrollCSV() {
      const hostAggs = Analytics.getHostAggregates(Analytics.getFilteredSessions());
      const summary = Payroll.calculatePayrollSummary(hostAggs, '2026-09');
      let csv = 'Host,Approved_Hours,Hourly_Rate,Base_Payment,Bonus,Total_Payment,Status\n';
      summary.items.forEach(p => {
        csv += `"${p.name}",${p.hours},${p.rate},${p.basePay},${p.bonus},${p.totalPay},"${p.status}"
`;
      });

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `payroll_summary_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
    }
  };

  window.App = App;
  document.addEventListener('DOMContentLoaded', async () => {
    if (window.DataLoader?.ready) await window.DataLoader.ready;
    if (window.Accounts?.ready) await window.Accounts.ready;
    App.init();
  });
})(window);
