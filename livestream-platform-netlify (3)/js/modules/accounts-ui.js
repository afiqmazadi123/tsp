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

      if (window.SupabaseAuth?.isAuthenticated?.()) {
        const currentAcc = Accounts.getCurrentAccount();
        const authUser = window.SupabaseAuth.getUser?.();

        container.innerHTML = `
          <div class="secure-profile-modal">
            <div class="user-avatar secure-profile-avatar" style="background:${currentAcc.avatarColor || '#0071e3'}">
              ${currentAcc.initials || ''}
            </div>
            <div class="secure-profile-copy">
              <h3>${currentAcc.name}</h3>
              <p>${currentAcc.role}</p>
              <span>${authUser?.email || 'Authenticated user'}</span>
            </div>
            <div class="secure-profile-status">
              <span>Authenticated</span>
              <strong>Supabase Auth + RLS</strong>
            </div>
            <div class="secure-profile-actions">
              ${currentAcc.canManageAccounts ? '<button class="apple-btn apple-btn-secondary" data-app-action="openAdminPanel">Open Admin</button>' : ''}
              <button class="apple-btn danger-btn" data-app-action="signOutSecureSession">Sign out</button>
            </div>
          </div>
        `;

        modal.classList.add('active');
        return;
      }

      window.AuthGate?.showLogin?.();
    },

    async signOutSecureSession() {
      this.closeModal?.();
      await window.SupabaseAuth?.signOut?.();
      window.location.reload();
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
      const account = Accounts.getAccount(accountId);
      if (!account) return;

      const confirmed = await window.UI?.confirm?.(
        `Delete access for "${account.name}"? Their Supabase login will also be removed.`,
        { title: 'Delete team access', confirmLabel: 'Delete access', danger: true }
      );
      if (!confirmed) return;

      try {
        await window.UI.withBusy(
          () => window.SupabaseEngine.invokeFunction('manage-subaccount', {
            action: 'delete',
            accountId
          }),
          'Removing team access…'
        );

        await window.SupabaseEngine.syncDown(false, false);
        window.UI?.toast?.('Team access removed.', 'success');
        this.adminActiveTab = 'sub-accounts';
        this.closeModal();
        this.renderCurrentView();
      } catch (err) {
        window.UI?.toast?.(err?.message || 'Unable to remove team access.', 'error');
      }
    },

    openAddAccountModal() {
      const modal = document.getElementById('generic-modal');
      const container = document.getElementById('modal-inner-content');
      if (!modal || !container) return;

      container.innerHTML = `
        <div class="secure-account-form-head">
          <span class="auth-security-pill">Secure Auth account</span>
          <h3 class="modal-title">Add Team Access</h3>
          <p>Create a Supabase login and map its dashboard permissions in one step.</p>
        </div>

        <form id="new-account-form" class="form-stack">
          <div class="form-grid-2">
            <div>
              <label class="form-label">Full Name</label>
              <input type="text" id="new-acc-name" required maxlength="80" placeholder="e.g. Sarah Putri" class="select-filter full-width" />
            </div>
            <div>
              <label class="form-label">Login Email</label>
              <input type="email" id="new-acc-email" required autocomplete="off" placeholder="name@company.com" class="select-filter full-width" />
            </div>
          </div>

          <div class="form-grid-2">
            <div>
              <label class="form-label">Role & Title</label>
              <input type="text" id="new-acc-role" required maxlength="100" placeholder="e.g. Senior Shift Evaluator" class="select-filter full-width" />
            </div>
            <div>
              <label class="form-label">Initial Password</label>
              <input type="password" id="new-acc-password" minlength="8" required autocomplete="new-password" placeholder="Minimum 8 characters" class="select-filter full-width code-input" />
              <span class="helper-text">Share this password privately. It is never stored in the dashboard.</span>
            </div>
          </div>

          <div class="form-grid-2">
            <div>
              <label class="form-label">Role Description</label>
              <input type="text" id="new-acc-desc" maxlength="180" placeholder="e.g. Evening shift evaluator" class="select-filter full-width" />
            </div>
            <div>
              <label class="form-label">Avatar Color</label>
              <input type="color" id="new-acc-color" value="#0071e3" class="color-input" />
            </div>
          </div>

          <div class="permission-box">
            <span class="section-label">Access permissions</span>
            <label class="checkbox-row">
              <input type="checkbox" id="new-acc-grade" checked /> Grade and review creators
            </label>
            <label class="checkbox-row">
              <input type="checkbox" id="new-acc-rates" /> Manage host hourly rate cards
            </label>
            <label class="checkbox-row">
              <input type="checkbox" id="new-acc-payroll" /> Verify and approve payroll
            </label>
            <label class="checkbox-row">
              <input type="checkbox" id="new-acc-weights" /> Edit scoring weights
            </label>
            <label class="checkbox-row">
              <input type="checkbox" id="new-acc-accounts" /> Manage team accounts & security
            </label>
          </div>

          <div id="new-account-error" class="auth-gate-error" hidden></div>

          <div class="form-actions">
            <button type="button" class="apple-btn apple-btn-secondary" data-app-action="closeModal">Cancel</button>
            <button type="submit" class="apple-btn apple-btn-primary" id="new-account-submit">Create Login & Access</button>
          </div>
        </form>
      `;

      const form = document.getElementById('new-account-form');
      form?.addEventListener('submit', async (event) => {
        event.preventDefault();

        const submit = document.getElementById('new-account-submit');
        const errorBox = document.getElementById('new-account-error');
        const payload = {
          action: 'create',
          name: document.getElementById('new-acc-name').value.trim(),
          email: document.getElementById('new-acc-email').value.trim(),
          password: document.getElementById('new-acc-password').value,
          role: document.getElementById('new-acc-role').value.trim(),
          avatarColor: document.getElementById('new-acc-color').value,
          description: document.getElementById('new-acc-desc').value.trim(),
          canGrade: document.getElementById('new-acc-grade').checked,
          canManageRates: document.getElementById('new-acc-rates').checked,
          canApprovePayroll: document.getElementById('new-acc-payroll').checked,
          canEditWeights: document.getElementById('new-acc-weights').checked,
          canManageAccounts: document.getElementById('new-acc-accounts').checked
        };

        if (submit) {
          submit.disabled = true;
          submit.textContent = 'Creating secure access…';
        }
        if (errorBox) errorBox.hidden = true;

        try {
          await window.SupabaseEngine.invokeFunction('manage-subaccount', payload);
          document.getElementById('new-acc-password').value = '';
          await window.SupabaseEngine.syncDown(false, false);

          window.UI?.toast?.(`Secure login created for ${payload.name}.`, 'success');
          this.adminActiveTab = 'sub-accounts';
          this.closeModal();
          this.renderCurrentView();
        } catch (err) {
          if (errorBox) {
            errorBox.textContent = err?.message || 'Unable to create team access.';
            errorBox.hidden = false;
          }
          if (submit) {
            submit.disabled = false;
            submit.textContent = 'Create Login & Access';
          }
        }
      });

      modal.classList.add('active');
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
              <label class="form-label">Authentication</label>
              <div class="auth-status-field">
                <span class="auth-status-dot"></span>
                <strong>${acc.auth_user_id ? 'Supabase Auth linked' : 'Not linked'}</strong>
              </div>
              <span class="helper-text">Passwords are managed by Supabase Auth and are never shown here.</span>
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
              <input type="checkbox" id="edit-acc-weights" ${acc.canEditWeights ? 'checked' : ''} /> Can edit scoring weights
            </label>
            <label class="checkbox-row">
              <input type="checkbox" id="edit-acc-accounts" ${acc.canManageAccounts ? 'checked' : ''} /> Can manage team accounts & security
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
        const avatarColor = document.getElementById('edit-acc-color').value;
        const description = document.getElementById('edit-acc-desc').value.trim();
        const canGrade = document.getElementById('edit-acc-grade').checked;
        const canManageRates = document.getElementById('edit-acc-rates').checked;
        const canApprovePayroll = document.getElementById('edit-acc-payroll').checked;
        const canEditWeights = document.getElementById('edit-acc-weights').checked;
        const canManageAccounts = document.getElementById('edit-acc-accounts').checked;

        const accountUpdates = {
          name,
          role,
          avatarColor,
          description,
          canGrade,
          canManageRates,
          canApprovePayroll,
          canEditWeights,
          canManageAccounts
        };
        Accounts.updateAccount(accountId, accountUpdates);

        this.updateAccountUI();
        this.closeModal();
        this.renderCurrentView();
      };

      modal.classList.add('active');
    },


  });
})(window);
