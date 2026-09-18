/**
 * Livestream Performance Intelligence Platform
 * Sub-account management with hashed local PIN access guards.
 *
 * Important: this is still a client-side access guard, not a replacement for
 * server-side authentication. PINs are PBKDF2-hashed before persistence.
 */

(function(window) {
  'use strict';

  const PBKDF2_ITERATIONS = 120000;
  const encoder = new TextEncoder();

  const DEFAULT_ACCOUNTS = [
    {
      id: 'acc_afiq',
      name: 'Afiq Mazadi',
      role: 'Lead Live Operations',
      roleType: 'admin',
      pin: 'pbkdf2$120000$G4lfU3gfybNjn/XwpnLeBQ==$UkyRHxW1jsUSrJMJUL1kQdPdBUGyVPAfv/6JWcz8988=',
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
      pin: 'pbkdf2$120000$ZjBtBufzAs0PyieQzQSn3A==$74d2pMQyWlaty4d91qwTEL+c3CmMIkDIf/4wtkDSteQ=',
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
      pin: 'pbkdf2$120000$KtpWRlnvIc8RffOSCf2UoQ==$5Nk0Di5MitFRNG6Rcmr20EXnrCqU/+PurlIpVbFdbC0=',
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
      pin: 'pbkdf2$120000$eZiuLw0q5xttUyKZCA3UPw==$unfUZbKGtI2yi4NtRh9xiT6X4fSbX1fbogJJhGtEZ54=',
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
      pin: 'pbkdf2$120000$PCsPMv/e/ORtBz2KzY9dBA==$CslUZUWZae2zkScZR+wrn/KMRgiW/5sJbr/Chlw9jqU=',
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

  function cloneDefaults() {
    return DEFAULT_ACCOUNTS.map(account => ({ ...account }));
  }

  function bytesToBase64(bytes) {
    let binary = '';
    bytes.forEach(byte => { binary += String.fromCharCode(byte); });
    return btoa(binary);
  }

  function base64ToBytes(value) {
    const binary = atob(value);
    return Uint8Array.from(binary, char => char.charCodeAt(0));
  }

  function isHashedPin(value) {
    return typeof value === 'string' && value.startsWith('pbkdf2
  async function derivePin(pin, saltBytes, iterations = PBKDF2_ITERATIONS) {
    if (!window.crypto?.subtle) {
      throw new Error('Secure PIN hashing is not supported by this browser.');
    }

    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(String(pin)),
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    );

    const bits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: saltBytes,
        iterations,
        hash: 'SHA-256'
      },
      keyMaterial,
      256
    );

    return new Uint8Array(bits);
  }

  async function encodePin(pin) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const derived = await derivePin(pin, salt);
    return `pbkdf2$${PBKDF2_ITERATIONS}$${bytesToBase64(salt)}$${bytesToBase64(derived)}`;
  }

  async function verifyEncodedPin(encoded, inputPin) {
    const parts = String(encoded).split('$');
    if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;

    const iterations = Number(parts[1]);
    if (!Number.isFinite(iterations) || iterations < 1) return false;

    const salt = base64ToBytes(parts[2]);
    const expected = base64ToBytes(parts[3]);
    const actual = await derivePin(inputPin, salt, iterations);

    if (actual.length !== expected.length) return false;

    let mismatch = 0;
    for (let i = 0; i < actual.length; i++) mismatch |= actual[i] ^ expected[i];
    return mismatch === 0;
  }

  const Accounts = {
    accounts: [],
    currentAccountId: 'acc_afiq',
    ready: Promise.resolve(),

    init() {
      const savedAccounts = typeof localStorage !== 'undefined' ? localStorage.getItem('fyc_sub_accounts') : null;

      if (savedAccounts) {
        try {
          const parsed = JSON.parse(savedAccounts);
          this.accounts = Array.isArray(parsed) && parsed.length ? parsed : cloneDefaults();
        } catch (e) {
          this.accounts = cloneDefaults();
        }
      } else {
        this.accounts = cloneDefaults();
      }

      let modified = false;
      this.accounts.forEach(acc => {
        sanitizeAccount(acc);
        if (acc.pin === undefined || acc.pin === null) {
          acc.pin = '';
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
        if (acc.canEditWeights === undefined) {
          acc.canEditWeights = acc.roleType === 'admin' || acc.roleType === 'executive';
          modified = true;
        }
      });

      this.currentAccountId = (typeof localStorage !== 'undefined' ? localStorage.getItem('fyc_current_account') : null) || 'acc_afiq';
      if (!this.getAccount(this.currentAccountId)) {
        this.currentAccountId = this.accounts[0]?.id || 'acc_afiq';
      }

      if (modified) this.persist();
      this.ready = this.migrateLegacyPins();
      return this.ready;
    },

    persist() {
      if (typeof localStorage === 'undefined') return;
      try {
        localStorage.setItem('fyc_sub_accounts', JSON.stringify(this.accounts));
      } catch (err) {
        console.warn('Unable to persist sub-accounts:', err);
      }
    },

    async migrateLegacyPins() {
      let changed = false;

      for (const account of this.accounts) {
        if (account.pin && !isHashedPin(account.pin)) {
          try {
            account.pin = await encodePin(account.pin);
            changed = true;
          } catch (err) {
            console.warn(`Unable to migrate PIN for ${account.name}:`, err);
          }
        }
      }

      if (changed) this.persist();
      return changed;
    },

    getAccounts() {
      return this.accounts || cloneDefaults();
    },

    getReviewerAccounts() {
      return this.getAccounts().filter(a => a.canGrade);
    },

    getCurrentAccount() {
      return this.getAccount(this.currentAccountId) || this.accounts[0] || DEFAULT_ACCOUNTS[0];
    },

    getAccount(id) {
      return this.getAccounts().find(a => a.id === id);
    },

    getAccountByName(name) {
      if (!name) return null;
      return this.getAccounts().find(a => String(a.name).toLowerCase() === String(name).toLowerCase());
    },

    hasPin(accountOrId) {
      const account = typeof accountOrId === 'string' ? this.getAccount(accountOrId) : accountOrId;
      return !!(account && typeof account.pin === 'string' && account.pin.trim());
    },

    async verifyPin(accountId, inputPin) {
      await this.ready;
      const acc = this.getAccount(accountId);
      if (!acc) return false;
      if (!this.hasPin(acc)) return true;

      if (isHashedPin(acc.pin)) {
        try {
          return await verifyEncodedPin(acc.pin, String(inputPin || ''));
        } catch (err) {
          console.warn('PIN verification failed:', err);
          return false;
        }
      }

      // Legacy fallback. Successful access triggers immediate migration.
      const valid = acc.pin.trim() === String(inputPin || '').trim();
      if (valid) this.setPin(accountId, inputPin);
      return valid;
    },

    async setPin(accountId, pin) {
      const acc = this.getAccount(accountId);
      if (!acc) return null;

      const cleanPin = String(pin || '').trim();
      acc.pin = cleanPin ? await encodePin(cleanPin) : '';
      this.persist();

      if (window.SupabaseEngine?.saveAccount) {
        window.SupabaseEngine.saveAccount(acc);
      }

      return acc;
    },

    switchAccount(id) {
      const acc = this.getAccount(id);
      if (!acc) return null;

      this.currentAccountId = id;
      if (typeof localStorage !== 'undefined') localStorage.setItem('fyc_current_account', id);
      return acc;
    },

    can(permission) {
      const acc = this.getCurrentAccount();
      return !!(acc && acc[permission]);
    },

    addAccount(newAcc) {
      const source = { ...newAcc };
      const rawPin = source.pin;
      delete source.pin;

      const account = sanitizeAccount({
        ...source,
        id: 'acc_' + Date.now(),
        initials: String(source.name || 'TM').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'TM',
        canGrade: source.canGrade !== undefined ? source.canGrade : true,
        canManageRates: source.canManageRates !== undefined ? source.canManageRates : false,
        canManageAccounts: source.canManageAccounts !== undefined ? source.canManageAccounts : false,
        canApprovePayroll: source.canApprovePayroll !== undefined ? source.canApprovePayroll : false,
        canEditWeights: source.canEditWeights !== undefined ? source.canEditWeights : false,
        avatarColor: source.avatarColor || '#0071e3',
        pin: ''
      });

      this.accounts.push(account);
      this.persist();

      const finishCloudSave = () => {
        if (window.SupabaseEngine?.saveAccount) window.SupabaseEngine.saveAccount(account);
      };

      if (String(rawPin || '').trim()) {
        this.setPin(account.id, rawPin).then(finishCloudSave).catch(console.warn);
      } else {
        finishCloudSave();
      }

      return account;
    },

    updateAccount(id, updatedFields) {
      const idx = this.accounts.findIndex(a => a.id === id);
      if (idx === -1) return null;

      const fields = { ...updatedFields };
      const hasNewPin = Object.prototype.hasOwnProperty.call(fields, 'pin');
      const rawPin = fields.pin;
      delete fields.pin;

      const existing = this.accounts[idx];
      this.accounts[idx] = sanitizeAccount({
        ...existing,
        ...fields,
        initials: String(fields.name || existing.name).split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
      });

      this.persist();

      if (hasNewPin) {
        this.setPin(id, rawPin).catch(console.warn);
      } else if (window.SupabaseEngine?.saveAccount) {
        window.SupabaseEngine.saveAccount(this.accounts[idx]);
      }

      return this.accounts[idx];
    },

    deleteAccount(id) {
      if (this.accounts.length <= 1) return false;
      if (id === 'acc_afiq') return false;

      this.accounts = this.accounts.filter(a => a.id !== id);
      this.persist();

      if (window.SupabaseEngine?.deleteAccount) window.SupabaseEngine.deleteAccount(id);

      if (this.currentAccountId === id) {
        this.currentAccountId = this.accounts[0]?.id || 'acc_afiq';
        if (typeof localStorage !== 'undefined') localStorage.setItem('fyc_current_account', this.currentAccountId);
      }

      return true;
    }
  };

  Accounts.init();
  window.Accounts = Accounts;
})(window);
);
  }

  function cleanText(value, fallback = '') {
    return String(value ?? fallback)
      .replace(/[<>"']/g, '')
      .replace(/[\u0000-\u001F\u007F]/g, '')
      .trim();
  }

  function cleanColor(value) {
    const color = String(value || '').trim();
    return /^#[0-9a-f]{6}$/i.test(color) ? color : '#0071e3';
  }

  function sanitizeAccount(account) {
    account.name = cleanText(account.name, 'Team Member') || 'Team Member';
    account.role = cleanText(account.role, 'Team Member') || 'Team Member';
    account.description = cleanText(account.description, '');
    account.avatarColor = cleanColor(account.avatarColor);
    account.initials = cleanText(account.initials || account.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase(), 'TM').slice(0, 2).toUpperCase();
    return account;
  }

  async function derivePin(pin, saltBytes, iterations = PBKDF2_ITERATIONS) {
    if (!window.crypto?.subtle) {
      throw new Error('Secure PIN hashing is not supported by this browser.');
    }

    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(String(pin)),
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    );

    const bits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: saltBytes,
        iterations,
        hash: 'SHA-256'
      },
      keyMaterial,
      256
    );

    return new Uint8Array(bits);
  }

  async function encodePin(pin) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const derived = await derivePin(pin, salt);
    return `pbkdf2$${PBKDF2_ITERATIONS}$${bytesToBase64(salt)}$${bytesToBase64(derived)}`;
  }

  async function verifyEncodedPin(encoded, inputPin) {
    const parts = String(encoded).split('$');
    if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;

    const iterations = Number(parts[1]);
    if (!Number.isFinite(iterations) || iterations < 1) return false;

    const salt = base64ToBytes(parts[2]);
    const expected = base64ToBytes(parts[3]);
    const actual = await derivePin(inputPin, salt, iterations);

    if (actual.length !== expected.length) return false;

    let mismatch = 0;
    for (let i = 0; i < actual.length; i++) mismatch |= actual[i] ^ expected[i];
    return mismatch === 0;
  }

  const Accounts = {
    accounts: [],
    currentAccountId: 'acc_afiq',
    ready: Promise.resolve(),

    init() {
      const savedAccounts = typeof localStorage !== 'undefined' ? localStorage.getItem('fyc_sub_accounts') : null;

      if (savedAccounts) {
        try {
          const parsed = JSON.parse(savedAccounts);
          this.accounts = Array.isArray(parsed) && parsed.length ? parsed : cloneDefaults();
        } catch (e) {
          this.accounts = cloneDefaults();
        }
      } else {
        this.accounts = cloneDefaults();
      }

      let modified = false;
      this.accounts.forEach(acc => {
        if (acc.pin === undefined || acc.pin === null) {
          acc.pin = '';
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
        if (acc.canEditWeights === undefined) {
          acc.canEditWeights = acc.roleType === 'admin' || acc.roleType === 'executive';
          modified = true;
        }
      });

      this.currentAccountId = (typeof localStorage !== 'undefined' ? localStorage.getItem('fyc_current_account') : null) || 'acc_afiq';
      if (!this.getAccount(this.currentAccountId)) {
        this.currentAccountId = this.accounts[0]?.id || 'acc_afiq';
      }

      if (modified) this.persist();
      this.ready = this.migrateLegacyPins();
      return this.ready;
    },

    persist() {
      if (typeof localStorage === 'undefined') return;
      try {
        localStorage.setItem('fyc_sub_accounts', JSON.stringify(this.accounts));
      } catch (err) {
        console.warn('Unable to persist sub-accounts:', err);
      }
    },

    async migrateLegacyPins() {
      let changed = false;

      for (const account of this.accounts) {
        if (account.pin && !isHashedPin(account.pin)) {
          try {
            account.pin = await encodePin(account.pin);
            changed = true;
          } catch (err) {
            console.warn(`Unable to migrate PIN for ${account.name}:`, err);
          }
        }
      }

      if (changed) this.persist();
      return changed;
    },

    getAccounts() {
      return this.accounts || cloneDefaults();
    },

    getReviewerAccounts() {
      return this.getAccounts().filter(a => a.canGrade);
    },

    getCurrentAccount() {
      return this.getAccount(this.currentAccountId) || this.accounts[0] || DEFAULT_ACCOUNTS[0];
    },

    getAccount(id) {
      return this.getAccounts().find(a => a.id === id);
    },

    getAccountByName(name) {
      if (!name) return null;
      return this.getAccounts().find(a => String(a.name).toLowerCase() === String(name).toLowerCase());
    },

    hasPin(accountOrId) {
      const account = typeof accountOrId === 'string' ? this.getAccount(accountOrId) : accountOrId;
      return !!(account && typeof account.pin === 'string' && account.pin.trim());
    },

    async verifyPin(accountId, inputPin) {
      await this.ready;
      const acc = this.getAccount(accountId);
      if (!acc) return false;
      if (!this.hasPin(acc)) return true;

      if (isHashedPin(acc.pin)) {
        try {
          return await verifyEncodedPin(acc.pin, String(inputPin || ''));
        } catch (err) {
          console.warn('PIN verification failed:', err);
          return false;
        }
      }

      // Legacy fallback. Successful access triggers immediate migration.
      const valid = acc.pin.trim() === String(inputPin || '').trim();
      if (valid) this.setPin(accountId, inputPin);
      return valid;
    },

    async setPin(accountId, pin) {
      const acc = this.getAccount(accountId);
      if (!acc) return null;

      const cleanPin = String(pin || '').trim();
      acc.pin = cleanPin ? await encodePin(cleanPin) : '';
      this.persist();

      if (window.SupabaseEngine?.saveAccount) {
        window.SupabaseEngine.saveAccount(acc);
      }

      return acc;
    },

    switchAccount(id) {
      const acc = this.getAccount(id);
      if (!acc) return null;

      this.currentAccountId = id;
      if (typeof localStorage !== 'undefined') localStorage.setItem('fyc_current_account', id);
      return acc;
    },

    can(permission) {
      const acc = this.getCurrentAccount();
      return !!(acc && acc[permission]);
    },

    addAccount(newAcc) {
      const source = { ...newAcc };
      const rawPin = source.pin;
      delete source.pin;

      const account = {
        ...source,
        id: 'acc_' + Date.now(),
        initials: String(source.name || 'TM').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'TM',
        canGrade: source.canGrade !== undefined ? source.canGrade : true,
        canManageRates: source.canManageRates !== undefined ? source.canManageRates : false,
        canManageAccounts: source.canManageAccounts !== undefined ? source.canManageAccounts : false,
        canApprovePayroll: source.canApprovePayroll !== undefined ? source.canApprovePayroll : false,
        canEditWeights: source.canEditWeights !== undefined ? source.canEditWeights : false,
        avatarColor: source.avatarColor || '#0071e3',
        pin: ''
      };

      this.accounts.push(account);
      this.persist();

      const finishCloudSave = () => {
        if (window.SupabaseEngine?.saveAccount) window.SupabaseEngine.saveAccount(account);
      };

      if (String(rawPin || '').trim()) {
        this.setPin(account.id, rawPin).then(finishCloudSave).catch(console.warn);
      } else {
        finishCloudSave();
      }

      return account;
    },

    updateAccount(id, updatedFields) {
      const idx = this.accounts.findIndex(a => a.id === id);
      if (idx === -1) return null;

      const fields = { ...updatedFields };
      const hasNewPin = Object.prototype.hasOwnProperty.call(fields, 'pin');
      const rawPin = fields.pin;
      delete fields.pin;

      const existing = this.accounts[idx];
      this.accounts[idx] = {
        ...existing,
        ...fields,
        initials: String(fields.name || existing.name).split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
      };

      this.persist();

      if (hasNewPin) {
        this.setPin(id, rawPin).catch(console.warn);
      } else if (window.SupabaseEngine?.saveAccount) {
        window.SupabaseEngine.saveAccount(this.accounts[idx]);
      }

      return this.accounts[idx];
    },

    deleteAccount(id) {
      if (this.accounts.length <= 1) return false;
      if (id === 'acc_afiq') return false;

      this.accounts = this.accounts.filter(a => a.id !== id);
      this.persist();

      if (window.SupabaseEngine?.deleteAccount) window.SupabaseEngine.deleteAccount(id);

      if (this.currentAccountId === id) {
        this.currentAccountId = this.accounts[0]?.id || 'acc_afiq';
        if (typeof localStorage !== 'undefined') localStorage.setItem('fyc_current_account', this.currentAccountId);
      }

      return true;
    }
  };

  Accounts.init();
  window.Accounts = Accounts;
})(window);
