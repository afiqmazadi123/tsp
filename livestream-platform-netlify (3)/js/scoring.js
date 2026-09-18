/**
 * Livestream Performance Intelligence Platform
 * Configurable Scoring Engine & Multi-Reviewer Assessment
 * Enhanced with Full Edit, Update, Delete & Sub-Account Reviewer Binding
 */

(function(window) {
  'use strict';

  const Scoring = {
    assessments: [],
    weights: {
      overall: { performance: 70, assessment: 30 },
      performance: { gmv: 40, gmv_hr: 33, ctor: 27, views: 0, sold_qty: 0 },
      assessment: { cta: 30, pin: 25, discipline: 25, grooming: 20 }
    },

    init() {
      // Load saved weights
      const savedWeights = localStorage.getItem('fyc_scoring_weights');
      if (savedWeights) {
        try { this.weights = JSON.parse(savedWeights); } catch (e) {}
      } else if (window.MASTER_CONFIG && window.MASTER_CONFIG.weights) {
        this.weights = JSON.parse(JSON.stringify(window.MASTER_CONFIG.weights));
      }

      this.normalizeAllWeights();
      localStorage.setItem('fyc_scoring_weights', JSON.stringify(this.weights));

      // Load saved assessments
      const savedAssessments = localStorage.getItem('fyc_assessments');
      if (savedAssessments) {
        try { this.assessments = JSON.parse(savedAssessments); } catch (e) {}
      } else if (window.MASTER_ASSESSMENTS) {
        this.assessments = JSON.parse(JSON.stringify(window.MASTER_ASSESSMENTS));
      }

      // Normalize legacy assessment records into the twice-monthly cycle model.
      let modified = false;
      this.assessments.forEach((a, idx) => {
        if (!a.id) {
          a.id = 'rev_' + (idx + 1) + '_' + Math.random().toString(36).substring(2, 7);
          modified = true;
        }

        const assessmentDate = a.date || new Date().toISOString().split('T')[0];
        const month = this.normalizeMonth(a.assessment_month || assessmentDate.slice(0, 7));
        const cycle = a.cycle || this.getCycleForDate(assessmentDate);
        const reviewerAccount = window.Accounts?.getAccounts?.().find(
          account => String(account.name || '').toLowerCase() === String(a.reviewer || '').toLowerCase()
        );

        if (a.assessment_month !== month) {
          a.assessment_month = month;
          modified = true;
        }
        if (a.cycle !== cycle) {
          a.cycle = cycle;
          modified = true;
        }
        if (!a.reviewer_account_id && reviewerAccount?.id) {
          a.reviewer_account_id = reviewerAccount.id;
          modified = true;
        }
      });
      if (modified) {
        localStorage.setItem('fyc_assessments', JSON.stringify(this.assessments));
      }
    },

    getWeightGroupConfig(group) {
      const configs = {
        overall: { keys: ['performance', 'assessment'], min: 10 },
        performance: { keys: ['gmv', 'gmv_hr', 'ctor'], min: 5 },
        assessment: { keys: ['cta', 'pin', 'discipline', 'grooming'], min: 5 }
      };
      return configs[group] || null;
    },

    normalizeWeightGroup(group) {
      const config = this.getWeightGroupConfig(group);
      if (!config) return;

      const target = this.weights[group] || {};
      const keys = config.keys;
      const min = config.min;
      const base = min * keys.length;
      const remaining = 100 - base;

      const rawWeights = keys.map(key => Math.max(0, Number(target[key] || 0) - min));
      let rawTotal = rawWeights.reduce((sum, value) => sum + value, 0);
      if (rawTotal <= 0) {
        rawTotal = keys.length;
        for (let i = 0; i < rawWeights.length; i += 1) rawWeights[i] = 1;
      }

      const exactAdds = rawWeights.map(value => (value / rawTotal) * remaining);
      const adds = exactAdds.map(Math.floor);
      let leftover = remaining - adds.reduce((sum, value) => sum + value, 0);

      const order = exactAdds
        .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
        .sort((a, b) => b.fraction - a.fraction);

      for (let i = 0; i < leftover; i += 1) adds[order[i % order.length].index] += 1;

      keys.forEach((key, index) => {
        target[key] = min + adds[index];
      });

      if (group === 'performance') {
        target.views = 0;
        target.sold_qty = 0;
      }
    },

    normalizeAllWeights() {
      this.normalizeWeightGroup('overall');
      this.normalizeWeightGroup('performance');
      this.normalizeWeightGroup('assessment');
      return this.weights;
    },

    rebalanceWeightGroup(group, activeKey, nextValue) {
      const config = this.getWeightGroupConfig(group);
      if (!config || !config.keys.includes(activeKey)) return this.weights[group];

      const target = this.weights[group];
      const keys = config.keys;
      const min = config.min;
      const max = 100 - min * (keys.length - 1);
      const next = Math.max(min, Math.min(max, Math.round(Number(nextValue) || min)));

      target[activeKey] = next;

      const otherKeys = keys.filter(key => key !== activeKey);
      const remaining = 100 - next;
      const distributable = remaining - min * otherKeys.length;

      const relative = otherKeys.map(key => Math.max(0, Number(target[key] || 0) - min));
      let relativeTotal = relative.reduce((sum, value) => sum + value, 0);
      if (relativeTotal <= 0) {
        relativeTotal = otherKeys.length;
        for (let i = 0; i < relative.length; i += 1) relative[i] = 1;
      }

      const exactAdds = relative.map(value => (value / relativeTotal) * distributable);
      const adds = exactAdds.map(Math.floor);
      let leftover = distributable - adds.reduce((sum, value) => sum + value, 0);

      const order = exactAdds
        .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
        .sort((a, b) => b.fraction - a.fraction);

      for (let i = 0; i < leftover; i += 1) adds[order[i % order.length].index] += 1;

      otherKeys.forEach((key, index) => {
        target[key] = min + adds[index];
      });

      if (group === 'performance') {
        target.views = 0;
        target.sold_qty = 0;
      }

      return target;
    },

    saveWeights(newWeights) {
      this.weights = newWeights;
      this.normalizeAllWeights();
      localStorage.setItem('fyc_scoring_weights', JSON.stringify(this.weights));
    },

    normalizeMonth(value) {
      const raw = String(value || '').trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw.slice(0, 7) + '-01';
      if (/^\d{4}-\d{2}$/.test(raw)) return raw + '-01';

      const date = raw ? new Date(raw) : new Date();
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      return `${year}-${month}-01`;
    },

    getCurrentMonth() {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    },

    getCycleForDate(value = new Date()) {
      const date = value instanceof Date ? value : new Date(`${value}T12:00:00`);
      return date.getDate() <= 15 ? 'mid_month' : 'end_month';
    },

    getCycleLabel(cycle) {
      return cycle === 'end_month' ? 'End-Month' : 'Mid-Month';
    },

    getCycleDateLabel(month, cycle) {
      const normalized = this.normalizeMonth(month);
      const [year, monthNumber] = normalized.split('-').map(Number);
      const endDay = new Date(year, monthNumber, 0).getDate();
      return cycle === 'end_month'
        ? `16–${endDay}`
        : '1–15';
    },

    getAssessmentById(id) {
      return this.assessments.find(a => a.id === id);
    },

    getReviewsForMonth(month) {
      const normalized = this.normalizeMonth(month || this.getCurrentMonth());
      return this.assessments.filter(a => this.normalizeMonth(a.assessment_month || a.date) === normalized);
    },

    getReviewsForCycle(month, cycle) {
      return this.getReviewsForMonth(month).filter(a => (a.cycle || this.getCycleForDate(a.date)) === cycle);
    },

    getHostReviews(hostName, month = null) {
      const source = month ? this.getReviewsForMonth(month) : this.assessments;
      return source.filter(a => String(a.host || '').toLowerCase() === String(hostName || '').toLowerCase());
    },

    getReviewsByReviewer(reviewerName, month = null, cycle = null) {
      let source = month ? this.getReviewsForMonth(month) : this.assessments;
      if (cycle) source = source.filter(a => (a.cycle || this.getCycleForDate(a.date)) === cycle);
      return source.filter(a => String(a.reviewer || '').toLowerCase() === String(reviewerName || '').toLowerCase());
    },

    getHostReviewByReviewer(hostName, reviewerName, month = null, cycle = null) {
      let source = this.getHostReviews(hostName, month);
      if (cycle) source = source.filter(a => (a.cycle || this.getCycleForDate(a.date)) === cycle);

      return source.find(
        a => String(a.reviewer || '').toLowerCase() === String(reviewerName || '').toLowerCase()
      );
    },

    getReviewerMonthlySummaries(hostName, month) {
      const reviews = this.getHostReviews(hostName, month);
      const groups = new Map();

      reviews.forEach(review => {
        const key = review.reviewer_account_id || String(review.reviewer || '').toLowerCase();
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(review);
      });

      return Array.from(groups.values()).map(reviewerReviews => {
        const count = reviewerReviews.length || 1;
        const avg = field => reviewerReviews.reduce((sum, item) => sum + (parseFloat(item[field]) || 4), 0) / count;
        const cycles = new Set(reviewerReviews.map(item => item.cycle || this.getCycleForDate(item.date)));

        return {
          reviewer: reviewerReviews[0]?.reviewer || 'Reviewer',
          reviewer_account_id: reviewerReviews[0]?.reviewer_account_id || null,
          cta: avg('cta'),
          pin: avg('pin'),
          discipline: avg('discipline'),
          grooming: avg('grooming'),
          cycleCount: cycles.size,
          completedBothCycles: cycles.has('mid_month') && cycles.has('end_month'),
          reviews: reviewerReviews
        };
      });
    },

    addAssessment(review) {
      const assessmentDate = review.date || new Date().toISOString().split('T')[0];
      const assessmentMonth = this.normalizeMonth(review.assessment_month || assessmentDate.slice(0, 7));
      const cycle = review.cycle || this.getCycleForDate(assessmentDate);
      const reviewerAccount = review.reviewer_account_id
        ? window.Accounts?.getAccount?.(review.reviewer_account_id)
        : window.Accounts?.getAccounts?.().find(
            account => String(account.name || '').toLowerCase() === String(review.reviewer || '').toLowerCase()
          );

      const normalized = {
        ...review,
        date: assessmentDate,
        assessment_month: assessmentMonth,
        cycle,
        reviewer_account_id: review.reviewer_account_id || reviewerAccount?.id || null,
        cta: parseFloat(review.cta) || 4.0,
        pin: parseFloat(review.pin) || 4.0,
        discipline: parseFloat(review.discipline) || 4.0,
        grooming: parseFloat(review.grooming) || 4.0,
        notes: (review.notes || '').trim()
      };

      const existingIdx = this.assessments.findIndex(a => {
        const sameHost = String(a.host || '').toLowerCase() === String(normalized.host || '').toLowerCase();
        const sameReviewer = normalized.reviewer_account_id && a.reviewer_account_id
          ? a.reviewer_account_id === normalized.reviewer_account_id
          : String(a.reviewer || '').toLowerCase() === String(normalized.reviewer || '').toLowerCase();
        const sameMonth = this.normalizeMonth(a.assessment_month || a.date) === assessmentMonth;
        const sameCycle = (a.cycle || this.getCycleForDate(a.date)) === cycle;
        return sameHost && sameReviewer && sameMonth && sameCycle;
      });

      let savedReview;
      if (existingIdx >= 0) {
        savedReview = {
          ...this.assessments[existingIdx],
          ...normalized,
          id: this.assessments[existingIdx].id
        };
        this.assessments[existingIdx] = savedReview;
      } else {
        savedReview = {
          ...normalized,
          id: normalized.id || ('rev_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6))
        };
        this.assessments.push(savedReview);
      }

      localStorage.setItem('fyc_assessments', JSON.stringify(this.assessments));
      window.AppStore?.invalidate?.();
      if (window.SupabaseEngine && typeof window.SupabaseEngine.saveAssessment === 'function') {
        window.SupabaseEngine.saveAssessment(savedReview);
      }
      return savedReview;
    },

    updateAssessment(id, updatedFields) {
      const idx = this.assessments.findIndex(a => a.id === id);
      if (idx === -1) return null;

      const existing = this.assessments[idx];
      this.assessments[idx] = {
        ...existing,
        ...updatedFields,
        cta: updatedFields.cta !== undefined ? parseFloat(updatedFields.cta) : existing.cta,
        pin: updatedFields.pin !== undefined ? parseFloat(updatedFields.pin) : existing.pin,
        discipline: updatedFields.discipline !== undefined ? parseFloat(updatedFields.discipline) : existing.discipline,
        grooming: updatedFields.grooming !== undefined ? parseFloat(updatedFields.grooming) : existing.grooming,
        date: updatedFields.date || existing.date || new Date().toISOString().split('T')[0],
        assessment_month: this.normalizeMonth(updatedFields.assessment_month || existing.assessment_month || existing.date),
        cycle: updatedFields.cycle || existing.cycle || this.getCycleForDate(updatedFields.date || existing.date),
        reviewer_account_id: updatedFields.reviewer_account_id || existing.reviewer_account_id || null
      };

      localStorage.setItem('fyc_assessments', JSON.stringify(this.assessments));
      window.AppStore?.invalidate?.();
      if (window.SupabaseEngine && typeof window.SupabaseEngine.saveAssessment === 'function') window.SupabaseEngine.saveAssessment(this.assessments[idx]);
      return this.assessments[idx];
    },

    deleteAssessment(id) {
      this.assessments = this.assessments.filter(a => a.id !== id);
      localStorage.setItem('fyc_assessments', JSON.stringify(this.assessments));
      window.AppStore?.invalidate?.();
      if (window.SupabaseEngine && typeof window.SupabaseEngine.deleteAssessment === 'function') window.SupabaseEngine.deleteAssessment(id);
      return true;
    },

    calculateHostAssessment(hostName, month = null) {
      const assessmentMonth = month || window.App?.assessmentMonth || this.getCurrentMonth();
      const reviewerSummaries = this.getReviewerMonthlySummaries(hostName, assessmentMonth);

      if (reviewerSummaries.length === 0) {
        return {
          cta: 4.0,
          pin: 4.0,
          discipline: 4.0,
          grooming: 4.0,
          reviewCount: 0,
          reviewerCount: 0,
          completeReviewerCount: 0,
          rawAverage: 4.0,
          weightedScore: 80.0,
          reviewerSummaries: []
        };
      }

      const reviewerCount = reviewerSummaries.length;
      const avgAcrossPICs = field =>
        reviewerSummaries.reduce((sum, summary) => sum + Number(summary[field] || 4), 0) / reviewerCount;

      const cta = avgAcrossPICs('cta');
      const pin = avgAcrossPICs('pin');
      const discipline = avgAcrossPICs('discipline');
      const grooming = avgAcrossPICs('grooming');

      const w = this.weights.assessment;
      const totalW = (w.cta + w.pin + w.discipline + w.grooming) || 100;

      const weightedAvgOutOf5 = (
        cta * (w.cta / totalW) +
        pin * (w.pin / totalW) +
        discipline * (w.discipline / totalW) +
        grooming * (w.grooming / totalW)
      );

      return {
        cta,
        pin,
        discipline,
        grooming,
        reviewCount: reviewerSummaries.reduce((sum, summary) => sum + summary.reviews.length, 0),
        reviewerCount,
        completeReviewerCount: reviewerSummaries.filter(summary => summary.completedBothCycles).length,
        rawAverage: (cta + pin + discipline + grooming) / 4,
        weightedScore: (weightedAvgOutOf5 / 5.0) * 100,
        reviewerSummaries
      };
    },

    computeAllHostScores(hostAggregates, assessmentMonth = null) {
      if (!hostAggregates || hostAggregates.length === 0) return [];

      let maxGMV = 1, maxGMVHr = 1, maxCTOR = 1, maxViews = 1, maxSold = 1;

      hostAggregates.forEach(h => {
        if (h.gmv > maxGMV) maxGMV = h.gmv;
        if (h.gmvHour > maxGMVHr) maxGMVHr = h.gmvHour;
        if (h.avgCtor > maxCTOR) maxCTOR = h.avgCtor;
        if (h.views > maxViews) maxViews = h.views;
        if (h.sold > maxSold) maxSold = h.sold;
      });

      const pw = this.weights.performance;
      const totalPw = (pw.gmv + pw.gmv_hr + pw.ctor) || 100;

      const overallW = this.weights.overall;
      const perfRatio = (overallW.performance || 70) / 100;
      const assessRatio = (overallW.assessment || 30) / 100;

      const scoredHosts = hostAggregates.map(h => {
        const normGMV = (h.gmv / maxGMV) * 100;
        const normGMVHr = (h.gmvHour / maxGMVHr) * 100;
        const normCTOR = (h.avgCtor / maxCTOR) * 100;
        const normViews = (h.views / maxViews) * 100;
        const normSold = (h.sold / maxSold) * 100;

        const perfScore = (
          normGMV * (pw.gmv / totalPw) +
          normGMVHr * (pw.gmv_hr / totalPw) +
          normCTOR * (pw.ctor / totalPw)
        );

        const assessData = this.calculateHostAssessment(h.name, assessmentMonth);
        const assessScore = assessData.weightedScore;
        const finalScore = (perfScore * perfRatio) + (assessScore * assessRatio);

        let tier = 'Developing';
        let tierColor = '#ff9f0a';
        if (finalScore >= 80) {
          tier = 'Top Star';
          tierColor = '#30d158';
        } else if (finalScore >= 65) {
          tier = 'Senior Host';
          tierColor = '#0071e3';
        }

        return {
          ...h,
          perfScore,
          assessData,
          assessScore,
          finalScore,
          tier,
          tierColor
        };
      });

      scoredHosts.sort((a, b) => b.finalScore - a.finalScore);
      scoredHosts.forEach((h, index) => {
        h.rank = index + 1;
      });

      return scoredHosts;
    }
  };

  Scoring.init();
  window.Scoring = Scoring;
})(window);
