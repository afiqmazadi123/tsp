/**
 * Extracted from app.js — account UI and switching
 */
(function(window) {
  'use strict';
  const App = window.App;
  if (!App) return;

  Object.assign(App, {
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
          <button class="apple-btn apple-btn-primary" style="padding:5px 12px;font-size:12px;" data-app-action="openAddAccountModal">+ New Evaluator</button>
        </div>

        <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:20px;">
          ${accounts.map(acc => `
            <div class="account-item-card ${acc.id === currentAcc.id ? 'active-account' : ''}" data-app-action="requestAccountSwitch" data-app-arg="${acc.id}">
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
                  <button class="review-action-btn delete" data-app-action="deleteAccount" data-app-arg="${acc.id}" data-stop-propagation="true" title="Delete this sub-account">
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
          <button class="apple-btn apple-btn-secondary" data-app-action="openAdminPanel">Open Admin Management Panel</button>
          <button class="apple-btn apple-btn-secondary" data-app-action="closeModal">Close</button>
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

      if (window.SupabaseAuth?.isAuthenticated?.()) {
        const authUserId = window.SupabaseAuth.getUser()?.id;
        const boundAccount = Accounts.getAccounts().find(account => account.auth_user_id === authUserId);

        if (!boundAccount) {
          window.UI?.toast?.('This signed-in Supabase user is not linked to a dashboard sub-account.', 'warning');
          return;
        }
        if (boundAccount.id !== targetAccountId) {
          window.UI?.toast?.('Secure Auth mode locks the dashboard to the signed-in identity.', 'warning');
          return;
        }
      }

      if (Accounts.hasPin(targetAcc) && currentAcc.id !== 'acc_afiq') {
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
              <button type="button" class="apple-btn apple-btn-secondary" data-app-action="openAccountSwitcherModal">Back</button>
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

    async deleteAccount(accountId) {
      const acc = Accounts.getAccount(accountId);
      if (!acc) return;

      const confirmed = await window.UI?.confirm?.(
        `Delete sub-account "${acc.name}" (${acc.role})? This cannot be undone.`,
        { title: 'Delete sub-account', confirmLabel: 'Delete', danger: true }
      );
      if (!confirmed) return;

      if (Accounts.deleteAccount(accountId)) {
        window.UI?.toast?.('Sub-account deleted.', 'success');
        this.updateAccountUI();
        this.openAccountSwitcherModal();
        this.renderCurrentView();
      }
    },

    openAddAccountModal() {
      const modal = document.getElementById('generic-modal');
      const container = document.getElementById('modal-inner-content');
      if (!modal || !container) return;

      container.innerHTML = `
        <h3 class="modal-title">Add New Team Evaluator / Sub-Account</h3>
        <form id="new-account-form" class="form-stack">
          <div>
            <label class="form-label">Full Name</label>
            <input type="text" id="new-acc-name" required placeholder="e.g. Sarah Quality Lead" class="select-filter full-width" />
          </div>

          <div>
            <label class="form-label">Role & Title</label>
            <input type="text" id="new-acc-role" required placeholder="e.g. Senior Shift Evaluator" class="select-filter full-width" />
          </div>

          <div class="form-grid-2">
            <div>
              <label class="form-label">Access PIN / Password</label>
              <input type="password" id="new-acc-pin" required autocomplete="new-password" placeholder="Set access PIN" class="select-filter full-width code-input" />
            </div>
            <div>
              <label class="form-label">Avatar Color</label>
              <input type="color" id="new-acc-color" value="#0071e3" class="color-input" />
            </div>
          </div>

          <div>
            <label class="form-label">Role Description</label>
            <input type="text" id="new-acc-desc" placeholder="e.g. Evaluator for evening beauty shifts" class="select-filter full-width" />
          </div>

          <div class="permission-box">
            <span class="section-label">Permissions:</span>
            <label class="checkbox-row">
              <input type="checkbox" id="new-acc-grade" checked /> Can grade and review creators (Evaluator)
            </label>
            <label class="checkbox-row">
              <input type="checkbox" id="new-acc-rates" /> Can manage host hourly rate cards
            </label>
            <label class="checkbox-row">
              <input type="checkbox" id="new-acc-payroll" /> Can verify and approve payroll
            </label>
          </div>

          <div class="form-actions">
            <button type="button" class="apple-btn apple-btn-secondary" data-app-action="openAccountSwitcherModal">Back</button>
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

        window.UI?.toast?.(`Sub-account ${newAcc.name} created.`, 'success');
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
        <h3 class="modal-title">Edit Sub-Account: ${acc.name}</h3>
        <form id="edit-account-form" class="form-stack">
          <div>
            <label class="form-label">Full Name</label>
            <input type="text" id="edit-acc-name" value="${acc.name}" required class="select-filter full-width" />
          </div>

          <div>
            <label class="form-label">Role & Title</label>
            <input type="text" id="edit-acc-role" value="${acc.role}" required class="select-filter full-width" />
          </div>

          <div class="form-grid-2">
            <div>
              <label class="form-label">PIN / Password</label>
              <input type="password" id="edit-acc-pin" value="" autocomplete="new-password" placeholder="Leave blank to keep current PIN" class="select-filter full-width code-input" />
            </div>
            <div>
              <label class="form-label">Avatar Color</label>
              <input type="color" id="edit-acc-color" value="${acc.avatarColor || '#0071e3'}" class="color-input" />
            </div>
          </div>

          <div>
            <label class="form-label">Role Description</label>
            <input type="text" id="edit-acc-desc" value="${acc.description || ''}" class="select-filter full-width" />
          </div>

          <div class="permission-box">
            <span class="section-label">Permissions:</span>
            <label class="checkbox-row">
              <input type="checkbox" id="edit-acc-grade" ${acc.canGrade ? 'checked' : ''} /> Can grade and review creators (Evaluator)
            </label>
            <label class="checkbox-row">
              <input type="checkbox" id="edit-acc-rates" ${acc.canManageRates ? 'checked' : ''} /> Can manage host hourly rate cards
            </label>
            <label class="checkbox-row">
              <input type="checkbox" id="edit-acc-payroll" ${acc.canApprovePayroll ? 'checked' : ''} /> Can verify and approve payroll
            </label>
            <label class="checkbox-row">
              <input type="checkbox" id="edit-acc-accounts" ${acc.canManageAccounts ? 'checked' : ''} /> Can manage sub-accounts & security
            </label>
          </div>

          <div class="form-actions">
            <button type="button" class="apple-btn apple-btn-secondary" data-app-action="closeModal">Cancel</button>
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


  });
})(window);
