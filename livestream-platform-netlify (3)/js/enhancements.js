/**
 * FYC Dashboard UX Enhancements
 * Non-destructive enhancement layer loaded after app.js.
 */
(function (window, document) {
  'use strict';

  if (!window.App || !window.Analytics) return;

  const DAY = 86400000;

  function toISO(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function parseISO(value) {
    if (!value) return null;
    const parts = String(value).split('-').map(Number);
    if (parts.length !== 3 || parts.some(Number.isNaN)) return null;
    return new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
  }

  function getBounds(sessions) {
    const dates = (sessions || []).map(s => s && s.date).filter(Boolean).sort();
    return {
      min: dates[0] || null,
      max: dates[dates.length - 1] || null
    };
  }

  function addDays(dateStr, amount) {
    const date = parseISO(dateStr);
    if (!date) return dateStr;
    date.setDate(date.getDate() + amount);
    return toISO(date);
  }

  function formatPeriod(start, end) {
    if (!start && !end) return 'All available data';
    const fmt = value => {
      const d = parseISO(value);
      return d ? d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : value;
    };
    return start === end ? fmt(start) : `${fmt(start)} – ${fmt(end)}`;
  }

  // Fix hardcoded dataset date bounds and off-by-one date ranges.
  Analytics.getFilteredSessions = function (sessions = window.MASTER_SESSIONS || []) {
    const { dateRange, startDate, endDate, platform, brand, host } = this.filters;
    const bounds = getBounds(sessions);

    let start = startDate;
    let end = endDate;

    if (dateRange !== 'custom' && dateRange !== 'all' && bounds.max) {
      const anchor = parseISO(bounds.max);

      if (dateRange === 'today') {
        start = bounds.max;
        end = bounds.max;
      } else if (dateRange === '7d') {
        start = addDays(bounds.max, -6);
        end = bounds.max;
      } else if (dateRange === '30d') {
        start = addDays(bounds.max, -29);
        end = bounds.max;
      } else if (dateRange === 'this_month') {
        start = toISO(new Date(anchor.getFullYear(), anchor.getMonth(), 1, 12));
        end = bounds.max;
      } else if (dateRange === 'last_month') {
        start = toISO(new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1, 12));
        end = toISO(new Date(anchor.getFullYear(), anchor.getMonth(), 0, 12));
      } else if (dateRange === 'jul_2026') {
        start = '2026-07-01';
        end = '2026-07-31';
      }
    }

    return sessions.filter(s => {
      if (!s) return false;
      if (platform !== 'all' && String(s.platform || '').toLowerCase() !== String(platform).toLowerCase()) return false;
      if (brand !== 'all' && s.brand !== brand) return false;
      if (host !== 'all' && s.host !== host) return false;
      if (start && s.date < start) return false;
      if (end && s.date > end) return false;
      return true;
    });
  };

  function baseFilteredSessions() {
    const all = window.MASTER_SESSIONS || [];
    const { platform, brand, host } = Analytics.filters;
    return all.filter(s => {
      if (platform !== 'all' && String(s.platform || '').toLowerCase() !== String(platform).toLowerCase()) return false;
      if (brand !== 'all' && s.brand !== brand) return false;
      if (host !== 'all' && s.host !== host) return false;
      return true;
    });
  }

  function getComparison(currentSessions) {
    if (!currentSessions || !currentSessions.length || Analytics.filters.dateRange === 'all') return null;
    const bounds = getBounds(currentSessions);
    if (!bounds.min || !bounds.max) return null;

    const start = parseISO(bounds.min);
    const end = parseISO(bounds.max);
    const spanDays = Math.round((end - start) / DAY) + 1;
    const prevEnd = addDays(bounds.min, -1);
    const prevStart = addDays(prevEnd, -(spanDays - 1));

    const previous = baseFilteredSessions().filter(s => s.date >= prevStart && s.date <= prevEnd);
    if (!previous.length) return null;

    return {
      sessions: previous,
      start: prevStart,
      end: prevEnd,
      kpis: Analytics.calculateKPIs(previous)
    };
  }

  function deltaPct(current, previous) {
    if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return null;
    return ((current - previous) / Math.abs(previous)) * 100;
  }

  function deltaMarkup(value, fallback) {
    if (value === null || !Number.isFinite(value)) {
      return `<span class="delta-badge neutral">${fallback || 'No prior period'}</span>`;
    }
    const positive = value >= 0;
    const cls = positive ? 'positive' : 'negative';
    const arrow = positive ? '↑' : '↓';
    return `<span class="delta-badge ${cls}">${arrow} ${Math.abs(value).toFixed(1)}%</span><span>vs previous period</span>`;
  }

  function setDateControlsFromDataset() {
    const bounds = getBounds(window.MASTER_SESSIONS || []);
    if (!bounds.min || !bounds.max) return;

    const start = document.getElementById('filter-start-date');
    const end = document.getElementById('filter-end-date');
    if (start) {
      start.min = bounds.min;
      start.max = bounds.max;
      if (!parseISO(start.value) || start.value < bounds.min || start.value > bounds.max) start.value = bounds.min;
    }
    if (end) {
      end.min = bounds.min;
      end.max = bounds.max;
      if (!parseISO(end.value) || end.value < bounds.min || end.value > bounds.max) end.value = bounds.max;
    }

    const select = document.getElementById('filter-date-range');
    if (select) {
      const labels = {
        all: 'All available data',
        today: `Latest day (${formatPeriod(bounds.max, bounds.max)})`,
        '7d': 'Last 7 days',
        '30d': 'Last 30 days',
        this_month: 'Current data month',
        last_month: 'Previous month',
        custom: 'Custom date range…'
      };
      Array.from(select.options).forEach(option => {
        if (labels[option.value]) option.textContent = labels[option.value];
      });
    }

    const syncText = document.getElementById('sync-status-text');
    if (syncText) {
      syncText.textContent = `${(window.MASTER_SESSIONS || []).length.toLocaleString('id-ID')} shifts · through ${formatPeriod(bounds.max, bounds.max)}`;
    }
  }

  function setQuickRange(value) {
    const select = document.getElementById('filter-date-range');
    const custom = document.getElementById('custom-date-container');
    Analytics.setFilter('dateRange', value);
    if (select) select.value = value;
    if (custom) custom.style.display = value === 'custom' ? 'flex' : 'none';
    App.renderCurrentView();
  }

  function addDashboardTooltip(canvas) {
    if (!canvas || canvas.dataset.tooltipBound === '1') return;
    const wrapper = canvas.closest('.chart-wrapper');
    if (!wrapper) return;
    canvas.dataset.tooltipBound = '1';

    const tooltip = document.createElement('div');
    tooltip.className = 'chart-hover-tooltip';
    tooltip.hidden = true;
    wrapper.appendChild(tooltip);

    canvas.addEventListener('mousemove', e => {
      const points = canvas._chartPoints || [];
      if (!points.length) return;

      const x = e.offsetX;
      let nearest = points[0];
      let distance = Math.abs(points[0].x - x);
      points.forEach(point => {
        const d = Math.abs(point.x - x);
        if (d < distance) {
          nearest = point;
          distance = d;
        }
      });

      const datum = nearest.data || {};
      tooltip.innerHTML = `
        <strong>${formatPeriod(datum.date, datum.date)}</strong>
        <span>${window.AppleCharts ? AppleCharts.formatIDR(datum.value || 0) : (datum.value || 0).toLocaleString('id-ID')}</span>
        <small>${(datum.sessions || 0).toLocaleString('id-ID')} sessions · ${Number(datum.hours || 0).toFixed(1)}h</small>
      `;
      tooltip.style.left = `${Math.min(Math.max(nearest.x, 86), wrapper.clientWidth - 86)}px`;
      tooltip.style.top = `${Math.max(nearest.y - 16, 24)}px`;
      tooltip.hidden = false;
    });

    canvas.addEventListener('mouseleave', () => { tooltip.hidden = true; });
  }

  function enhanceDashboard(container, data) {
    const sessions = data.sessions || [];
    const kpis = data.kpis || Analytics.calculateKPIs(sessions);
    const bounds = getBounds(sessions);
    const comparison = getComparison(sessions);
    const cards = container.querySelectorAll('.kpi-card');

    const range = Analytics.filters.dateRange || 'all';
    const intro = document.createElement('section');
    intro.className = 'dashboard-context-bar';
    intro.innerHTML = `
      <div>
        <div class="eyebrow">Performance snapshot</div>
        <h2>Live commerce dashboard</h2>
        <p>${formatPeriod(bounds.min, bounds.max)} · ${sessions.length.toLocaleString('id-ID')} sessions currently in view</p>
      </div>
      <div class="quick-range-control" aria-label="Quick date range">
        ${[
          ['all', 'All'],
          ['7d', '7D'],
          ['30d', '30D'],
          ['this_month', 'Month']
        ].map(([value, label]) => `<button class="${range === value ? 'active' : ''}" data-quick-range="${value}">${label}</button>`).join('')}
      </div>
    `;
    const kpiGrid = container.querySelector('.kpi-grid');
    if (kpiGrid) container.insertBefore(intro, kpiGrid);

    intro.querySelectorAll('[data-quick-range]').forEach(btn => {
      btn.addEventListener('click', () => setQuickRange(btn.dataset.quickRange));
    });

    if (cards[0]) {
      const meta = cards[0].querySelector('.kpi-meta');
      if (meta) meta.innerHTML = deltaMarkup(comparison ? deltaPct(kpis.totalGMV, comparison.kpis.totalGMV) : null, range === 'all' ? 'Full dataset' : 'No prior data');
      cards[0].classList.add('kpi-clickable');
      cards[0].title = 'Open live analytics';
      cards[0].addEventListener('click', () => App.switchView('analytics'));
    }

    if (cards[2]) {
      const meta = cards[2].querySelector('.kpi-meta');
      if (meta) meta.innerHTML = deltaMarkup(comparison ? deltaPct(kpis.avgGmvHour, comparison.kpis.avgGmvHour) : null, range === 'all' ? 'Full dataset' : 'No prior data');
      cards[2].classList.add('kpi-clickable');
      cards[2].title = 'Open live analytics';
      cards[2].addEventListener('click', () => App.switchView('analytics'));
    }

    if (cards[3]) {
      cards[3].classList.add('kpi-clickable');
      cards[3].title = 'Open host performance';
      cards[3].addEventListener('click', () => App.switchView('hosts'));
    }

    const topHost = (data.scoredHosts || [])[0];
    const topBrand = (data.brandBreakdown || [])[0];
    const platforms = Object.entries(data.platformComp || {});
    const efficientPlatform = platforms.sort((a, b) => (b[1].gmvHour || 0) - (a[1].gmvHour || 0))[0];
    const peakDay = (data.gmvTrend || []).reduce((best, item) => !best || item.value > best.value ? item : best, null);

    if (kpiGrid && (topHost || topBrand || efficientPlatform || peakDay)) {
      const insights = document.createElement('section');
      insights.className = 'insight-grid';
      insights.innerHTML = `
        <button class="insight-card" data-target-view="hosts">
          <span class="insight-label">Top host</span>
          <strong>${topHost ? topHost.name : '—'}</strong>
          <small>${topHost ? `${AppleCharts.formatIDRShort(topHost.gmv)} GMV · ${topHost.finalScore.toFixed(1)} score` : 'No host data'}</small>
        </button>
        <button class="insight-card" data-target-view="brands">
          <span class="insight-label">Leading brand</span>
          <strong>${topBrand ? topBrand.brand : '—'}</strong>
          <small>${topBrand ? `${topBrand.share.toFixed(1)}% GMV share · ${AppleCharts.formatIDRShort(topBrand.gmv)}` : 'No brand data'}</small>
        </button>
        <button class="insight-card" data-target-view="analytics">
          <span class="insight-label">Most efficient platform</span>
          <strong>${efficientPlatform ? efficientPlatform[0] : '—'}</strong>
          <small>${efficientPlatform ? `${AppleCharts.formatIDRShort(efficientPlatform[1].gmvHour)}/hour` : 'No platform data'}</small>
        </button>
        <button class="insight-card" data-target-view="analytics">
          <span class="insight-label">Peak GMV day</span>
          <strong>${peakDay ? formatPeriod(peakDay.date, peakDay.date) : '—'}</strong>
          <small>${peakDay ? `${AppleCharts.formatIDRShort(peakDay.value)} · ${peakDay.sessions} sessions` : 'No trend data'}</small>
        </button>
      `;
      kpiGrid.insertAdjacentElement('afterend', insights);
      insights.querySelectorAll('[data-target-view]').forEach(btn => {
        btn.addEventListener('click', () => App.switchView(btn.dataset.targetView));
      });
    }

    const donut = document.getElementById('brandDonutCanvas');
    if (donut && data.brandBreakdown && data.brandBreakdown.length) {
      const legend = document.createElement('div');
      legend.className = 'brand-legend';
      legend.innerHTML = data.brandBreakdown.map(b => `
        <button data-brand="${String(b.brand).replace(/"/g, '&quot;')}">
          <span class="legend-dot" style="background:${b.color}"></span>
          <span>${b.brand}</span>
          <strong>${b.share.toFixed(1)}%</strong>
        </button>
      `).join('');
      donut.closest('.chart-wrapper').insertAdjacentElement('afterend', legend);
      legend.querySelectorAll('[data-brand]').forEach(btn => {
        btn.addEventListener('click', () => {
          Analytics.setFilter('brand', btn.dataset.brand);
          const select = document.getElementById('filter-brand');
          if (select) select.value = btn.dataset.brand;
          App.renderCurrentView();
        });
      });
    }

    setTimeout(() => addDashboardTooltip(document.getElementById('gmvTrendCanvas')), 90);
  }

  function emptyStateIfNeeded() {
    const dataViews = ['dashboard', 'analytics', 'hosts', 'brands'];
    if (!dataViews.includes(App.currentView)) return;
    const sessions = Analytics.getFilteredSessions();
    if (sessions.length) return;

    const area = document.getElementById('view-render-area');
    if (!area) return;
    area.innerHTML = `
      <div class="empty-filter-state">
        <div class="empty-icon">↺</div>
        <h3>No sessions match these filters</h3>
        <p>Try a wider date range, another platform, or reset the brand filter.</p>
        <button class="apple-btn apple-btn-primary" id="clear-all-filters">Reset filters</button>
      </div>
    `;
    document.getElementById('clear-all-filters')?.addEventListener('click', () => App.clearAllFilters());
  }

  App.clearAllFilters = function () {
    Analytics.filters = {
      dateRange: 'all',
      startDate: null,
      endDate: null,
      platform: 'all',
      brand: 'all',
      host: 'all'
    };

    document.querySelectorAll('.platform-seg-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.platform === 'all');
    });
    const brand = document.getElementById('filter-brand');
    const date = document.getElementById('filter-date-range');
    const custom = document.getElementById('custom-date-container');
    if (brand) brand.value = 'all';
    if (date) date.value = 'all';
    if (custom) custom.style.display = 'none';
    App.renderCurrentView();
  };

  const originalDashboard = App.renderDashboardView.bind(App);
  App.renderDashboardView = function (container, data) {
    originalDashboard(container, data);
    enhanceDashboard(container, data);
  };

  const originalRenderCurrentView = App.renderCurrentView.bind(App);
  App.renderCurrentView = function () {
    originalRenderCurrentView();
    emptyStateIfNeeded();
  };

  function humanizeNavigation() {
    const labels = {
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

    Object.entries(labels).forEach(([view, label]) => {
      const item = document.querySelector(`.nav-item[data-view="${view}"] span:not(.badge)`);
      if (item) item.textContent = label;
    });

    const sections = document.querySelectorAll('.nav-section-title');
    if (sections[0]) sections[0].textContent = 'Workspace';
    if (sections[1]) sections[1].textContent = 'Operations';
    if (sections[2]) sections[2].textContent = 'System';

    const brandTitle = document.querySelector('.brand-info h1');
    const brandSub = document.querySelector('.brand-info p');
    if (brandTitle) brandTitle.textContent = 'FYC Live Ops';
    if (brandSub) brandSub.textContent = 'Performance Dashboard';

    const pageTitle = document.getElementById('current-page-title');
    if (pageTitle && App.currentView === 'dashboard') pageTitle.textContent = 'Dashboard';

    const pitch = document.getElementById('btn-pitch-mode');
    if (pitch && !App.pitchModeActive) pitch.innerHTML = '<span>Presentation Mode</span>';
  }

  function addMobileNavigation() {
    const topbarLeft = document.querySelector('.topbar-left');
    const sidebar = document.getElementById('sidebar');
    if (!topbarLeft || !sidebar || document.getElementById('mobile-menu-btn')) return;

    const button = document.createElement('button');
    button.id = 'mobile-menu-btn';
    button.className = 'mobile-menu-btn';
    button.setAttribute('aria-label', 'Open navigation');
    button.innerHTML = '<span></span><span></span><span></span>';
    topbarLeft.insertBefore(button, topbarLeft.firstChild);

    const overlay = document.createElement('div');
    overlay.className = 'mobile-nav-overlay';
    document.body.appendChild(overlay);

    const close = () => {
      sidebar.classList.remove('mobile-open');
      document.body.classList.remove('mobile-nav-open');
    };

    button.addEventListener('click', () => {
      sidebar.classList.toggle('mobile-open');
      document.body.classList.toggle('mobile-nav-open', sidebar.classList.contains('mobile-open'));
    });
    overlay.addEventListener('click', close);
    document.querySelectorAll('.nav-item').forEach(item => item.addEventListener('click', close));
  }

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      App.closeModal?.();
      App.closeHostDrawer?.();
      document.getElementById('sidebar')?.classList.remove('mobile-open');
      document.body.classList.remove('mobile-nav-open');
    }

    if (event.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '')) {
      const search = document.getElementById('session-search-input');
      if (search) {
        event.preventDefault();
        search.focus();
      }
    }
  });

  async function initializeEnhancements() {
    if (window.DataLoader?.ready) await window.DataLoader.ready;
    setDateControlsFromDataset();
    humanizeNavigation();
    addMobileNavigation();
  }

  initializeEnhancements().catch(err => {
    console.warn('Enhancement initialization failed:', err);
  });

})(window, document);
