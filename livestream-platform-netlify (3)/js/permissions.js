/**
 * Client-side capability enforcement.
 * Prevents accidental access to privileged UI/actions based on the active sub-account.
 * This complements (but does not replace) server-side authorization.
 */
(function (window, document) {
  'use strict';

  if (!window.App || !window.Accounts) return;

  const original = {};
  const guardedViews = {
    payroll: ['canApprovePayroll'],
    assessment: ['canGrade'],
    settings: ['canManageAccounts']
  };

  function hasAny(permissions) {
    const current = Accounts.getCurrentAccount();
    return permissions.some(permission => !!current?.[permission]);
  }

  function deny(message = 'Your current account does not have permission to perform this action.') {
    const modal = document.getElementById('generic-modal');
    const container = document.getElementById('modal-inner-content');

    if (modal && container) {
      container.innerHTML = `
        <div class="permission-denied">
          <div class="permission-denied-icon">🔒</div>
          <h3>Permission required</h3>
          <p>${message}</p>
          <button class="apple-btn apple-btn-primary" data-close-permission-modal>Close</button>
        </div>
      `;
      container.querySelector('[data-close-permission-modal]')?.addEventListener('click', () => App.closeModal());
      modal.classList.add('active');
    } else {
      alert(message);
    }

    return false;
  }

  function canOpenView(viewName) {
    if (viewName === 'admin') {
      return hasAny(['canManageAccounts', 'canManageRates']);
    }
    const required = guardedViews[viewName];
    return !required || hasAny(required);
  }

  function wrap(methodName, permissions, message) {
    if (typeof App[methodName] !== 'function') return;
    original[methodName] = App[methodName].bind(App);

    App[methodName] = function (...args) {
      if (!hasAny(permissions)) return deny(message);
      return original[methodName](...args);
    };
  }

  original.switchView = App.switchView.bind(App);
  App.switchView = function (viewName) {
    if (!canOpenView(viewName)) {
      return deny('This section is restricted for the active sub-account.');
    }
    return original.switchView(viewName);
  };

  original.updateAccountUI = App.updateAccountUI.bind(App);
  App.updateAccountUI = function () {
    const result = original.updateAccountUI();
    updatePermissionUI();
    return result;
  };

  original.setAdminTab = App.setAdminTab.bind(App);
  App.setAdminTab = function (tabName) {
    if (tabName === 'sub-accounts' || tabName === 'cloud-sync') {
      if (!hasAny(['canManageAccounts'])) return deny('Account and cloud configuration requires Admin permission.');
    }
    if (tabName === 'host-rates') {
      if (!hasAny(['canManageRates'])) return deny('Host rate management requires Rates permission.');
    }
    return original.setAdminTab(tabName);
  };

  original.renderAdminView = App.renderAdminView.bind(App);
  App.renderAdminView = function (container, data) {
    if (this.adminActiveTab === 'host-rates' && !hasAny(['canManageRates'])) {
      this.adminActiveTab = hasAny(['canManageAccounts']) ? 'sub-accounts' : 'host-rates';
    }
    if ((this.adminActiveTab === 'sub-accounts' || this.adminActiveTab === 'cloud-sync') && !hasAny(['canManageAccounts'])) {
      this.adminActiveTab = hasAny(['canManageRates']) ? 'host-rates' : 'sub-accounts';
    }

    const result = original.renderAdminView(container, data);

    if (!hasAny(['canManageRates'])) {
      container.querySelector('.admin-tab-btn[onclick*="host-rates"]')?.remove();
    }
    if (!hasAny(['canManageAccounts'])) {
      container.querySelector('.admin-tab-btn[onclick*="sub-accounts"]')?.remove();
      container.querySelector('.admin-tab-btn[onclick*="cloud-sync"]')?.remove();
      container.querySelectorAll('button').forEach(button => {
        if (/backup|sub-account/i.test(button.textContent || '')) button.remove();
      });
    }

    return result;
  };

  // PIN verification must be asynchronous now that persisted PINs are PBKDF2 hashes.
  App.openVerifyPinModal = function (targetAccountId) {
    const targetAcc = Accounts.getAccount(targetAccountId);
    if (!targetAcc) return;

    const modal = document.getElementById('generic-modal');
    const container = document.getElementById('modal-inner-content');
    if (!modal || !container) return;

    container.innerHTML = `
      <div class="secure-pin-dialog">
        <div class="user-avatar secure-pin-avatar" style="background:${targetAcc.avatarColor || '#0071e3'}">
          ${targetAcc.initials || ''}
        </div>
        <h3>Unlock ${targetAcc.name}</h3>
        <p>${targetAcc.role}</p>

        <form id="verify-pin-form" class="secure-pin-form">
          <input
            type="password"
            inputmode="numeric"
            autocomplete="current-password"
            id="input-account-pin"
            maxlength="32"
            required
            autofocus
            placeholder="Enter PIN"
            class="select-filter secure-pin-input"
          />
          <div id="pin-error-msg" class="secure-pin-error" hidden>Incorrect PIN. Please try again.</div>

          <div class="secure-pin-actions">
            <button type="button" class="apple-btn apple-btn-secondary" data-pin-back>Back</button>
            <button type="submit" class="apple-btn apple-btn-primary" id="verify-pin-submit">Unlock</button>
          </div>
        </form>
      </div>
    `;

    container.querySelector('[data-pin-back]')?.addEventListener('click', () => App.openAccountSwitcherModal());

    const form = document.getElementById('verify-pin-form');
    form.onsubmit = async (event) => {
      event.preventDefault();
      const input = document.getElementById('input-account-pin');
      const error = document.getElementById('pin-error-msg');
      const submit = document.getElementById('verify-pin-submit');
      const pin = input.value;

      submit.disabled = true;
      submit.textContent = 'Checking…';
      error.hidden = true;

      const valid = await Accounts.verifyPin(targetAccountId, pin);
      if (valid) {
        App.selectAccount(targetAccountId);
        return;
      }

      submit.disabled = false;
      submit.textContent = 'Unlock';
      error.hidden = false;
      input.value = '';
      input.focus();
    };

    modal.classList.add('active');
  };

  wrap('openAddAccountModal', ['canManageAccounts'], 'Only account administrators can create sub-accounts.');
  wrap('openEditAccountModal', ['canManageAccounts'], 'Only account administrators can edit sub-accounts.');
  wrap('deleteAccount', ['canManageAccounts'], 'Only account administrators can delete sub-accounts.');
  wrap('exportFullBackupJSON', ['canManageAccounts'], 'Only account administrators can export a complete system backup.');
  wrap('openImportBackupModal', ['canManageAccounts'], 'Only account administrators can restore a system backup.');
  wrap('saveSheetSettings', ['canManageAccounts'], 'Only account administrators can change data source settings.');
  wrap('handleCSVFile', ['canManageAccounts'], 'Only account administrators can replace the master dataset.');
  wrap('openAdjustRateModal', ['canManageRates'], 'Your account cannot change host rate cards.');
  wrap('toggleHostPayrollStatus', ['canApprovePayroll'], 'Your account cannot approve or modify payroll status.');
  wrap('approveAllPayroll', ['canApprovePayroll'], 'Your account cannot approve payroll.');
  wrap('openAddReviewModal', ['canGrade'], 'Your account cannot grade hosts.');
  wrap('openEditReviewModal', ['canGrade'], 'Your account cannot edit host assessments.');
  wrap('deleteReview', ['canGrade'], 'Your account cannot delete host assessments.');
  wrap('onWeightChange', ['canEditWeights'], 'Only senior reviewers can change scoring weights.');
  wrap('resetDefaultWeights', ['canEditWeights'], 'Only senior reviewers can reset scoring weights.');

  ['connectSupabase', 'pullSupabaseData', 'pushSupabaseData', 'disconnectSupabase'].forEach(method => {
    wrap(method, ['canManageAccounts'], 'Only account administrators can manage cloud synchronization.');
  });

  function updatePermissionUI() {
    const navRules = {
      payroll: ['canApprovePayroll'],
      assessment: ['canGrade'],
      admin: ['canManageAccounts', 'canManageRates'],
      settings: ['canManageAccounts']
    };

    Object.entries(navRules).forEach(([view, permissions]) => {
      const item = document.querySelector(`.nav-item[data-view="${view}"]`);
      if (!item) return;
      item.hidden = !hasAny(permissions);
    });

    document.body.dataset.roleType = Accounts.getCurrentAccount()?.roleType || 'guest';
  }

  window.PermissionGate = {
    hasAny,
    deny,
    updateUI: updatePermissionUI
  };

  updatePermissionUI();
})(window, document);
