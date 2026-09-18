/**
 * Livestream Performance Intelligence Platform
 * Core UI controller: boot, navigation, filters, theme, and view dispatch.
 * Domain views and interactions live in js/modules/.
 */

(function(window) {
  'use strict';

  if (!window.Accounts) {
    throw new Error('Accounts module failed to load.');
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
        if (area) this.renderErrorState(area, err);
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
        dashboard: 'Dashboard',
        analytics: 'Live Analytics',
        hosts: 'Hosts',
        brands: 'Brands',
        payroll: 'Payroll',
        assessment: 'Assessments',
        reports: 'Reports',
        admin: 'Admin',
        settings: 'Settings'
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

      const applyTheme = (theme, persist = true) => {
        const normalized = theme === 'dark' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', normalized);
        document.documentElement.style.colorScheme = normalized;
        if (persist) localStorage.setItem('fyc_theme', normalized);

        if (toggle) {
          const switchingTo = normalized === 'dark' ? 'light' : 'dark';
          toggle.setAttribute('aria-label', `Switch to ${switchingTo} mode`);
          toggle.setAttribute('aria-pressed', normalized === 'dark' ? 'true' : 'false');
          toggle.title = `Switch to ${switchingTo} mode`;
          toggle.innerHTML = normalized === 'dark'
            ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>'
            : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
        }

        window.dispatchEvent(new CustomEvent('fyc:themechange', { detail: { theme: normalized } }));
      };

      const initial = document.documentElement.getAttribute('data-theme')
        || localStorage.getItem('fyc_theme')
        || (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      applyTheme(initial, false);

      if (toggle) {
        toggle.addEventListener('click', () => {
          const current = document.documentElement.getAttribute('data-theme') || 'light';
          const next = current === 'dark' ? 'light' : 'dark';
          applyTheme(next, true);
          this.renderCurrentView();
        });
      }
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

    renderErrorState(container, error) {
      container.innerHTML = `
        <div class="view-error-state" role="alert">
          <div class="view-error-icon">!</div>
          <h3>Something went wrong in this view</h3>
          <p>The rest of the dashboard is still available. Try rendering this section again.</p>
          <details>
            <summary>Technical details</summary>
            <code></code>
          </details>
          <button class="apple-btn apple-btn-primary" data-app-action="renderCurrentView">Try again</button>
        </div>
      `;
      const code = container.querySelector('code');
      if (code) code.textContent = error?.message || String(error || 'Unknown error');
    },

    // --- VIEW DISPATCHER ---
    renderCurrentView() {
      const container = document.getElementById('view-render-area');
      if (!container) return;

      try {
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
      } catch (error) {
        console.error(`View render failed (${this.currentView}):`, error);
        this.renderErrorState(container, error);
        window.UI?.toast?.('This view could not be rendered.', 'error');
      }
    },



  };

  window.App = App;
  document.addEventListener('DOMContentLoaded', async () => {
    try {
      if (window.Accounts?.ready) await window.Accounts.ready;
      if (window.SupabaseAuth?.ready) await window.SupabaseAuth.ready;

      if (!window.SupabaseAuth?.isAuthenticated?.()) {
        window.AuthGate?.showLogin?.();
        return;
      }

      const mapped = await window.SupabaseAuth.bindLocalAccount();
      if (!mapped) {
        window.AuthGate?.showUnauthorized?.();
        return;
      }

      // Hydrate the authenticated team roster from the cloud before any Admin UI renders.
      // This also drops stale LocalStorage-only accounts from the legacy PIN system.
      await window.SupabaseEngine?.syncDown?.(false, false);
      await window.DataLoader.load();
      window.AuthGate?.unlockApp?.();
      App.init();
    } catch (err) {
      console.error('Secure application boot failed:', err);
      window.AuthGate?.showError?.(err?.message || String(err));
    }
  });
})(window);
