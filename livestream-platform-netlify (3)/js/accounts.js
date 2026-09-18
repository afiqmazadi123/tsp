/**
 * Livestream Performance Intelligence Platform
 * Sub-Accounts & Reviewer Team Management Engine with Password/PIN Security
 */

(function(window) {
  'use strict';

  const DEFAULT_ACCOUNTS = [
    {
      id: 'acc_afiq',
      name: 'Afiq Mazadi',
      role: 'Lead Live Operations',
      roleType: 'admin',
      pin: '1234',
      avatarColor: '#0071e3',
      initials: 'AM',
      canGrade: true,
      canEditWeights: true,
      canApprovePayroll: true,
      canManageRates: true,
      canManageAccounts: true,
      description: 'Super Admin - Full system control, operations & grading'
    },
    {
      id: 'acc_harto',
      name: 'Ko Harto',
      role: 'Head of Livestreaming',
      roleType: 'executive',
      pin: '1234',
      avatarColor: '#bf5af2',
      initials: 'KH',
      canGrade: true,
      canEditWeights: true,
      canApprovePayroll: true,
      canManageRates: true,
      canManageAccounts: true,
      description: 'Executive Reviewer - Strategic management & senior grading'
    },
    {
      id: 'acc_cici',
      name: 'Cici',
      role: 'Quality & Host Assessment Supervisor',
      roleType: 'evaluator',
      pin: '1234',
      avatarColor: '#ff2d55',
      initials: 'CC',
      canGrade: true,
      canEditWeights: false,
      canApprovePayroll: false,
      canManageRates: false,
      canManageAccounts: false,
      description: 'Lead Evaluator - Host QA, grooming & CTA assessment'
    },
    {
      id: 'acc_aimee',
      name: 'Aimee',
      role: 'Livestream Operations Evaluator',
      roleType: 'evaluator',
      pin: '1234',
      avatarColor: '#30d158',
      initials: 'AI',
      canGrade: true,
      canEditWeights: false,
      canApprovePayroll: false,
      canManageRates: false,
      canManageAccounts: false,
      description: 'Shift Evaluator - Pinning & discipline assessment'
    },
    {
      id: 'acc_finance',
      name: 'Finance & HR Team',
      role: 'Payroll Verification Specialist',
      roleType: 'finance',
      pin: '1234',
      avatarColor: '#ff9f0a',
      initials: 'FN',
      canGrade: false,
      canEditWeights: false,
      canApprovePayroll: true,
      canManageRates: true,
      canManageAccounts: false,
      description: 'Finance Verifier - Live hours validation & payments'
    },
    {
      id: 'acc_brand',
      name: 'Brand Partner Guest',
      role: 'External Brand Partner',
      roleType: 'brand',
      pin: '',
      avatarColor: '#64d2ff',
      initials: 'BP',
      canGrade: false,
      canEditWeights: false,
      canApprovePayroll: false,
      canManageRates: false,
      canManageAccounts: false,
      description: 'Brand Pitch Mode - Restricted operational access'
    }
  ];

  const Accounts = {
    accounts: [],
    currentAccountId: 'acc_afiq',

    init() {
      const savedAccounts = typeof localStorage !== 'undefined' ? localStorage.getItem('fyc_sub_accounts') : null;
      if (savedAccounts) {
        try {
          this.accounts = JSON.parse(savedAccounts);
        } catch (e) {
          this.accounts = DEFAULT_ACCOUNTS;
        }
      } else {
        this.accounts = DEFAULT_ACCOUNTS;
      }

      // Ensure default accounts have PINs and permission fields
      let modified = false;
      this.accounts.forEach(acc => {
        if (acc.pin === undefined) {
          acc.pin = '1234';
          modified = true;
        }
        if (acc.canManageRates === undefined) {
          acc.canManageRates = acc.roleType === 'admin' || acc.roleType === 'executive' || acc.roleType === 'finance';
          modified = true;
        }
        if (acc.canManageAccounts === undefined) {
          acc.canManageAccounts = acc.roleType === 'admin' || acc.roleType === 'executive';
          modified = true;
        }
      });
      if (modified && typeof localStorage !== 'undefined') {
        localStorage.setItem('fyc_sub_accounts', JSON.stringify(this.accounts));
      }

      this.currentAccountId = (typeof localStorage !== 'undefined' ? localStorage.getItem('fyc_current_account') : null) || 'acc_afiq';
      if (!this.getAccount(this.currentAccountId)) {
        this.currentAccountId = this.accounts[0].id;
      }
    },

    getAccounts() {
      return this.accounts || DEFAULT_ACCOUNTS;
    },

    getReviewerAccounts() {
      return (this.accounts || DEFAULT_ACCOUNTS).filter(a => a.canGrade);
    },

    getCurrentAccount() {
      return this.getAccount(this.currentAccountId) || (this.accounts && this.accounts[0]) || DEFAULT_ACCOUNTS[0];
    },

    getAccount(id) {
      return (this.accounts || DEFAULT_ACCOUNTS).find(a => a.id === id);
    },

    getAccountByName(name) {
      if (!name) return null;
      return (this.accounts || DEFAULT_ACCOUNTS).find(a => a.name.toLowerCase() === name.toLowerCase());
    },

    verifyPin(accountId, inputPin) {
      const acc = this.getAccount(accountId);
      if (!acc) return false;
      if (!acc.pin || acc.pin.trim() === '') return true; // No pin required
      return acc.pin.trim() === String(inputPin).trim();
    },

    switchAccount(id) {
      const acc = this.getAccount(id);
      if (acc) {
        this.currentAccountId = id;
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('fyc_current_account', id);
        }
        return acc;
      }
      return null;
    },

    addAccount(newAcc) {
      newAcc.id = 'acc_' + Date.now();
      newAcc.initials = newAcc.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'TM';
      newAcc.canGrade = newAcc.canGrade !== undefined ? newAcc.canGrade : true;
      newAcc.canManageRates = newAcc.canManageRates !== undefined ? newAcc.canManageRates : false;
      newAcc.canManageAccounts = newAcc.canManageAccounts !== undefined ? newAcc.canManageAccounts : false;
      newAcc.canApprovePayroll = newAcc.canApprovePayroll !== undefined ? newAcc.canApprovePayroll : false;
      newAcc.canEditWeights = newAcc.canEditWeights !== undefined ? newAcc.canEditWeights : false;
      newAcc.pin = newAcc.pin !== undefined ? String(newAcc.pin).trim() : '1234';
      newAcc.avatarColor = newAcc.avatarColor || '#0071e3';
      
      this.accounts.push(newAcc);
      if (window.SupabaseEngine && typeof window.SupabaseEngine.saveAccount === "function") window.SupabaseEngine.saveAccount(newAcc);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('fyc_sub_accounts', JSON.stringify(this.accounts));
      }
      return newAcc;
    },

    updateAccount(id, updatedFields) {
      const idx = this.accounts.findIndex(a => a.id === id);
      if (idx === -1) return null;

      const existing = this.accounts[idx];
      this.accounts[idx] = {
        ...existing,
        ...updatedFields,
        initials: (updatedFields.name || existing.name).split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
      };

      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('fyc_sub_accounts', JSON.stringify(this.accounts));
      }
      return this.accounts[idx];
    },

    deleteAccount(id) {
      if (this.accounts.length <= 1) return false;
      // Prevent deleting primary super admin
      if (id === 'acc_afiq') {
        alert('Cannot delete primary Administrator account.');
        return false;
      }

      this.accounts = this.accounts.filter(a => a.id !== id);
      if (window.SupabaseEngine && typeof window.SupabaseEngine.deleteAccount === "function") window.SupabaseEngine.deleteAccount(id);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('fyc_sub_accounts', JSON.stringify(this.accounts));
      }
      if (this.currentAccountId === id) {
        this.currentAccountId = this.accounts[0].id;
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('fyc_current_account', this.currentAccountId);
        }
      }
      return true;
    }
  };

  Accounts.init();
  window.Accounts = Accounts;
})(window);
