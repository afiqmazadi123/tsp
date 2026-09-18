/**
 * Central derived-data store.
 * Memoizes expensive aggregations and only computes data required by the active view.
 */
(function (window) {
  'use strict';

  const cache = new Map();
  let datasetRef = null;

  function ensureDataset() {
    const current = window.MASTER_SESSIONS || [];
    if (current !== datasetRef) {
      datasetRef = current;
      cache.clear();
    }
    return current;
  }

  function filterKey() {
    const f = window.Analytics?.filters || {};
    return JSON.stringify([
      f.dateRange || 'all',
      f.startDate || '',
      f.endDate || '',
      f.platform || 'all',
      f.brand || 'all',
      f.host || 'all'
    ]);
  }

  function memo(key, factory) {
    const fullKey = `${filterKey()}::${key}`;
    if (!cache.has(fullKey)) cache.set(fullKey, factory());
    return cache.get(fullKey);
  }

  const AppStore = {
    invalidate() {
      cache.clear();
    },

    get sessions() {
      ensureDataset();
      return memo('sessions', () => Analytics.getFilteredSessions(datasetRef));
    },

    get kpis() {
      return memo('kpis', () => Analytics.calculateKPIs(this.sessions));
    },

    get hostAggs() {
      return memo('hostAggs', () => Analytics.getHostAggregates(this.sessions));
    },

    get brandBreakdown() {
      return memo('brandBreakdown', () => Analytics.getBrandBreakdown(this.sessions));
    },

    get platformComp() {
      return memo('platformComp', () => Analytics.getPlatformComparison(this.sessions));
    },

    get gmvTrend() {
      return memo('gmvTrend', () => Analytics.getGMVTrend(this.sessions));
    },

    get scoredHosts() {
      const weights = JSON.stringify(window.Scoring?.weights || {});
      const assessments = window.Scoring?.assessments || [];
      const assessmentKey = JSON.stringify(assessments);
      return memo(`scoredHosts:${weights}:${assessmentKey}`, () => Scoring.computeAllHostScores(this.hostAggs));
    },

    viewData(view) {
      switch (view) {
        case 'dashboard':
          return {
            kpis: this.kpis,
            scoredHosts: this.scoredHosts,
            brandBreakdown: this.brandBreakdown,
            platformComp: this.platformComp,
            gmvTrend: this.gmvTrend,
            sessions: this.sessions
          };
        case 'analytics':
          return { sessions: this.sessions, platformComp: this.platformComp };
        case 'hosts':
          return { scoredHosts: this.scoredHosts, sessions: this.sessions };
        case 'brands':
          return { brandBreakdown: this.brandBreakdown, scoredHosts: this.scoredHosts, sessions: this.sessions };
        case 'payroll':
          return { hostAggs: this.hostAggs };
        case 'assessment':
          return { scoredHosts: this.scoredHosts };
        case 'reports':
          return {
            kpis: this.kpis,
            scoredHosts: this.scoredHosts,
            brandBreakdown: this.brandBreakdown,
            platformComp: this.platformComp,
            sessions: this.sessions
          };
        case 'admin':
          return { scoredHosts: this.scoredHosts };
        default:
          return {};
      }
    }
  };

  window.AppStore = AppStore;
})(window);
