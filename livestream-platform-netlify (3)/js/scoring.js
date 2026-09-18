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

      // Ensure every assessment has a unique ID
      let modified = false;
      this.assessments.forEach((a, idx) => {
        if (!a.id) {
          a.id = 'rev_' + (idx + 1) + '_' + Math.random().toString(36).substring(2, 7);
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

    getAssessmentById(id) {
      return this.assessments.find(a => a.id === id);
    },

    getHostReviews(hostName) {
      return this.assessments.filter(a => a.host.toLowerCase() === hostName.toLowerCase());
    },

    getReviewsByReviewer(reviewerName) {
      return this.assessments.filter(a => a.reviewer.toLowerCase() === reviewerName.toLowerCase());
    },

    getHostReviewByReviewer(hostName, reviewerName) {
      return this.assessments.find(
        a => a.host.toLowerCase() === hostName.toLowerCase() &&
             a.reviewer.toLowerCase() === reviewerName.toLowerCase()
      );
    },

    addAssessment(review) {
      review.id = review.id || ('rev_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6));
      review.date = review.date || new Date().toISOString().split('T')[0];
      review.cta = parseFloat(review.cta) || 4.0;
      review.pin = parseFloat(review.pin) || 4.0;
      review.discipline = parseFloat(review.discipline) || 4.0;
      review.grooming = parseFloat(review.grooming) || 4.0;
      review.notes = (review.notes || '').trim();

      // Check if this reviewer already has a review for this host
      const existingIdx = this.assessments.findIndex(
        a => a.host.toLowerCase() === review.host.toLowerCase() &&
             a.reviewer.toLowerCase() === review.reviewer.toLowerCase()
      );

      if (existingIdx >= 0) {
        // Update existing rather than duplicating
        this.assessments[existingIdx] = {
          ...this.assessments[existingIdx],
          ...review
        };
      } else {
        this.assessments.push(review);
      }

      localStorage.setItem('fyc_assessments', JSON.stringify(this.assessments));
      if (window.SupabaseEngine && typeof window.SupabaseEngine.saveAssessment === 'function') window.SupabaseEngine.saveAssessment(review);
      return review;
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
        date: updatedFields.date || new Date().toISOString().split('T')[0]
      };

      localStorage.setItem('fyc_assessments', JSON.stringify(this.assessments));
      if (window.SupabaseEngine && typeof window.SupabaseEngine.saveAssessment === 'function') window.SupabaseEngine.saveAssessment(this.assessments[idx]);
      return this.assessments[idx];
    },

    deleteAssessment(id) {
      this.assessments = this.assessments.filter(a => a.id !== id);
      localStorage.setItem('fyc_assessments', JSON.stringify(this.assessments));
      if (window.SupabaseEngine && typeof window.SupabaseEngine.deleteAssessment === 'function') window.SupabaseEngine.deleteAssessment(id);
      return true;
    },

    calculateHostAssessment(hostName) {
      const reviews = this.getHostReviews(hostName);
      if (reviews.length === 0) {
        return {
          cta: 4.0,
          pin: 4.0,
          discipline: 4.0,
          grooming: 4.0,
          reviewCount: 0,
          rawAverage: 4.0,
          weightedScore: 80.0
        };
      }

      let ctaSum = 0, pinSum = 0, discSum = 0, groomSum = 0;
      reviews.forEach(r => {
        ctaSum += parseFloat(r.cta) || 4;
        pinSum += parseFloat(r.pin) || 4;
        discSum += parseFloat(r.discipline) || 4;
        groomSum += parseFloat(r.grooming) || 4;
      });

      const count = reviews.length;
      const cta = ctaSum / count;
      const pin = pinSum / count;
      const discipline = discSum / count;
      const grooming = groomSum / count;

      // Calculate weighted assessment score (0 - 100)
      const w = this.weights.assessment;
      const totalW = (w.cta + w.pin + w.discipline + w.grooming) || 100;
      
      const weightedAvgOutOf5 = (
        cta * (w.cta / totalW) +
        pin * (w.pin / totalW) +
        discipline * (w.discipline / totalW) +
        grooming * (w.grooming / totalW)
      );

      const weightedScore = (weightedAvgOutOf5 / 5.0) * 100;

      return {
        cta,
        pin,
        discipline,
        grooming,
        reviewCount: count,
        rawAverage: (cta + pin + discipline + grooming) / 4,
        weightedScore
      };
    },

    computeAllHostScores(hostAggregates) {
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

        const assessData = this.calculateHostAssessment(h.name);
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
