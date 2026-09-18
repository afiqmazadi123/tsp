/**
 * Full-screen authentication gate for FYC Live Ops.
 */
(function(window, document) {
  'use strict';

  const AuthGate = {
    root() {
      return document.getElementById('auth-gate-root');
    },

    lockApp() {
      document.body.classList.add('auth-pending');
      document.getElementById('app-container')?.setAttribute('aria-hidden', 'true');
    },

    unlockApp() {
      document.body.classList.remove('auth-pending');
      document.body.classList.add('auth-ready');
      document.getElementById('app-container')?.removeAttribute('aria-hidden');
      const root = this.root();
      if (root) {
        root.innerHTML = '';
        root.hidden = true;
      }
    },

    renderShell(content) {
      this.lockApp();
      const root = this.root();
      if (!root) return;
      root.hidden = false;
      root.innerHTML = `
        <div class="auth-gate-shell">
          <div class="auth-gate-brand">
            <div class="auth-gate-logo auth-gate-logo-brand" aria-hidden="true">
              <img src="assets/fyc-logo.svg" alt="" />
            </div>
            <div>
              <strong>FYC Live Ops</strong>
              <span>Private workspace</span>
            </div>
          </div>
          <div class="auth-gate-card">${content}</div>
          <p class="auth-gate-footer">Protected by Supabase Auth + Row Level Security</p>
        </div>
      `;
    },

    showLogin(message = '') {
      this.renderShell(`
        <div class="auth-gate-header">
          <span class="auth-security-pill">Secure access</span>
          <h1>Sign in to continue</h1>
          <p>Use your authorized FYC account. Dashboard data is not available without authentication.</p>
        </div>

        <form id="secure-login-form" class="auth-login-stack">
          <label>
            <span>Email</span>
            <input id="secure-login-email" type="email" autocomplete="username" required placeholder="name@company.com" />
          </label>
          <label>
            <span>Password</span>
            <input id="secure-login-password" type="password" autocomplete="current-password" required placeholder="Enter password" />
          </label>

          <div id="secure-login-error" class="auth-gate-error" ${message ? '' : 'hidden'}></div>

          <button id="secure-login-submit" type="submit" class="auth-login-submit">Sign in</button>
        </form>

        <div class="auth-login-help">
          <span>No public registration.</span>
          <span>Ask an administrator if you need access.</span>
        </div>
      `);

      const error = document.getElementById('secure-login-error');
      if (error && message) error.textContent = message;

      const form = document.getElementById('secure-login-form');
      form?.addEventListener('submit', async event => {
        event.preventDefault();

        const email = document.getElementById('secure-login-email')?.value.trim();
        const password = document.getElementById('secure-login-password')?.value || '';
        const submit = document.getElementById('secure-login-submit');
        const errorBox = document.getElementById('secure-login-error');

        if (submit) {
          submit.disabled = true;
          submit.textContent = 'Checking access…';
        }
        if (errorBox) errorBox.hidden = true;

        try {
          await window.SupabaseAuth.signIn(email, password);
          const mapped = await window.SupabaseAuth.bindLocalAccount();

          if (!mapped) {
            await window.SupabaseAuth.signOut();
            throw new Error('Login berhasil, tapi akun ini belum diberi akses ke workspace FYC.');
          }

          window.location.reload();
        } catch (err) {
          if (errorBox) {
            errorBox.textContent = err?.message || 'Unable to sign in.';
            errorBox.hidden = false;
          }
          if (submit) {
            submit.disabled = false;
            submit.textContent = 'Sign in';
          }
        }
      });

      window.setTimeout(() => document.getElementById('secure-login-email')?.focus(), 0);
    },

    showUnauthorized() {
      const email = window.SupabaseAuth?.getUser?.()?.email || 'this account';
      this.renderShell(`
        <div class="auth-gate-header">
          <span class="auth-security-pill warning">Authorization required</span>
          <h1>Account not mapped</h1>
          <p><strong>${this.escape(email)}</strong> is authenticated, but it is not linked to an authorized FYC sub-account.</p>
        </div>
        <div class="auth-gate-note">
          Ask an administrator to map this Supabase Auth user to a dashboard account.
        </div>
        <div class="auth-gate-actions">
          <button class="auth-secondary-btn" id="auth-retry-btn">Retry access check</button>
          <button class="auth-login-submit" id="auth-signout-btn">Sign out</button>
        </div>
      `);

      document.getElementById('auth-retry-btn')?.addEventListener('click', () => window.location.reload());
      document.getElementById('auth-signout-btn')?.addEventListener('click', async () => {
        await window.SupabaseAuth.signOut();
        window.location.reload();
      });
    },

    showError(message) {
      this.renderShell(`
        <div class="auth-gate-header">
          <span class="auth-security-pill warning">Secure workspace unavailable</span>
          <h1>Unable to load private data</h1>
          <p>The private workspace could not be loaded. A stale browser session will be repaired automatically on the next retry.</p>
        </div>
        <div class="auth-gate-error">${this.escape(message || 'Unknown error')}</div>
        <div class="auth-gate-actions">
          <button class="auth-secondary-btn" id="auth-error-signout">Reset session</button>
          <button class="auth-login-submit" id="auth-error-retry">Try again</button>
        </div>
      `);

      document.getElementById('auth-error-retry')?.addEventListener('click', () => window.location.reload());
      document.getElementById('auth-error-signout')?.addEventListener('click', async () => {
        await window.SupabaseAuth.signOut();
        window.location.reload();
      });
    },

    escape(value) {
      const node = document.createElement('div');
      node.textContent = String(value || '');
      return node.innerHTML;
    }
  };

  AuthGate.lockApp();
  window.AuthGate = AuthGate;
})(window, document);
