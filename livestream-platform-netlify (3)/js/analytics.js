/**
 * Livestream Performance Intelligence Platform
 * Analytics & Aggregation Engine
 */

(function(window) {
  'use strict';

  const Analytics = {
    filters: {
      dateRange: 'all',
      startDate: null,
      endDate: null,
      platform: 'all',
      brand: 'all',
      host: 'all'
    },

    setFilter(key, value) {
      this.filters[key] = value;
    },

    getFilteredSessions(sessions = window.MASTER_SESSIONS || []) {
      const { dateRange, startDate, endDate, platform, brand, host } = this.filters;

      // Determine date bounds
      let start = startDate;
      let end = endDate;

      if (dateRange !== 'custom' && dateRange !== 'all') {
        const maxDateStr = '2026-09-17'; // Anchor date of the master dataset
        const anchor = new Date(maxDateStr);

        if (dateRange === 'today') {
          start = maxDateStr;
          end = maxDateStr;
        } else if (dateRange === '7d') {
          const d = new Date(anchor);
          d.setDate(d.getDate() - 7);
          start = d.toISOString().split('T')[0];
          end = maxDateStr;
        } else if (dateRange === '30d') {
          const d = new Date(anchor);
          d.setDate(d.getDate() - 30);
          start = d.toISOString().split('T')[0];
          end = maxDateStr;
        } else if (dateRange === 'this_month') {
          start = '2026-09-01';
          end = '2026-09-17';
        } else if (dateRange === 'last_month') {
          start = '2026-08-01';
          end = '2026-08-31';
        } else if (dateRange === 'jul_2026') {
          start = '2026-07-01';
          end = '2026-07-31';
        }
      }

      return sessions.filter(s => {
        if (platform !== 'all' && s.platform.toLowerCase() !== platform.toLowerCase()) return false;
        if (brand !== 'all' && s.brand !== brand) return false;
        if (host !== 'all' && s.host !== host) return false;
        if (start && s.date < start) return false;
        if (end && s.date > end) return false;
        return true;
      });
    },

    calculateKPIs(sessions) {
      let totalGMV = 0;
      let totalDuration = 0;
      let totalViews = 0;
      let totalSold = 0;
      let totalBuyers = 0;
      let totalCtrSum = 0;
      let totalCtorSum = 0;
      let validCtrCount = 0;
      let validCtorCount = 0;
      const hostsSet = new Set();
      const brandsSet = new Set();

      sessions.forEach(s => {
        totalGMV += s.gmv || 0;
        totalDuration += s.duration || 0;
        totalViews += s.views || 0;
        totalSold += s.sold_qty || 0;
        totalBuyers += s.buyer || 0;

        if (s.ctr > 0) {
          totalCtrSum += s.ctr;
          validCtrCount++;
        }
        if (s.ctor > 0) {
          totalCtorSum += s.ctor;
          validCtorCount++;
        }

        if (s.host) hostsSet.add(s.host);
        if (s.brand) brandsSet.add(s.brand);
      });

      const avgGmvHour = totalDuration > 0 ? totalGMV / totalDuration : 0;
      const avgCtr = validCtrCount > 0 ? totalCtrSum / validCtrCount : 0;
      const avgCtor = validCtorCount > 0 ? totalCtorSum / validCtorCount : 0;

      return {
        totalGMV,
        totalDuration,
        avgGmvHour,
        activeHosts: hostsSet.size,
        activeBrands: brandsSet.size,
        totalViews,
        totalSold,
        totalBuyers,
        avgCtr,
        avgCtor,
        sessionCount: sessions.length
      };
    },

    getPlatformComparison(sessions) {
      const platforms = {
        TikTok: { gmv: 0, duration: 0, views: 0, sold: 0, ctorSum: 0, ctorCount: 0, sessions: 0 },
        Shopee: { gmv: 0, duration: 0, views: 0, sold: 0, ctorSum: 0, ctorCount: 0, sessions: 0 }
      };

      sessions.forEach(s => {
        const p = s.platform === 'Shopee' ? 'Shopee' : 'TikTok';
        platforms[p].gmv += s.gmv || 0;
        platforms[p].duration += s.duration || 0;
        platforms[p].views += s.views || 0;
        platforms[p].sold += s.sold_qty || 0;
        platforms[p].sessions++;
        if (s.ctor > 0) {
          platforms[p].ctorSum += s.ctor;
          platforms[p].ctorCount++;
        }
      });

      const result = {};
      const totalGMV = (platforms.TikTok.gmv + platforms.Shopee.gmv) || 1;
      const totalDuration = (platforms.TikTok.duration + platforms.Shopee.duration) || 1;

      ['TikTok', 'Shopee'].forEach(p => {
        const item = platforms[p];
        result[p] = {
          ...item,
          gmvHour: item.duration > 0 ? item.gmv / item.duration : 0,
          avgCtor: item.ctorCount > 0 ? item.ctorSum / item.ctorCount : 0,
          gmvShare: (item.gmv / totalGMV) * 100,
          durationShare: (item.duration / totalDuration) * 100
        };
      });

      return result;
    },

    getBrandBreakdown(sessions) {
      const brands = {};
      let totalGMV = 0;

      sessions.forEach(s => {
        const b = s.brand || 'Other';
        if (!brands[b]) {
          brands[b] = { brand: b, gmv: 0, duration: 0, views: 0, sold: 0, sessions: 0, hosts: new Set(), platforms: new Set() };
        }
        brands[b].gmv += s.gmv || 0;
        brands[b].duration += s.duration || 0;
        brands[b].views += s.views || 0;
        brands[b].sold += s.sold_qty || 0;
        brands[b].sessions++;
        brands[b].hosts.add(s.host);
        brands[b].platforms.add(s.platform);
        totalGMV += s.gmv || 0;
      });

      const brandColors = {
        'YESSICA SHOP': '#0071e3',
        'NUFACE': '#2997ff',
        'AWDAY': '#bf5af2',
        '4CONNECT': '#ff9f0a',
        'YESSICA MALAY': '#30d158',
        'BEAUTY OUTLET': '#ff375f'
      };

      return Object.values(brands).map(b => ({
        ...b,
        hostCount: b.hosts.size,
        platforms: Array.from(b.platforms),
        gmvHour: b.duration > 0 ? b.gmv / b.duration : 0,
        share: totalGMV > 0 ? (b.gmv / totalGMV) * 100 : 0,
        color: brandColors[b.brand] || '#64d2ff'
      })).sort((a, b) => b.gmv - a.gmv);
    },

    getHostAggregates(sessions) {
      const hostMap = {};

      sessions.forEach(s => {
        const h = s.host || 'Unknown';
        if (!hostMap[h]) {
          hostMap[h] = {
            name: h,
            gmv: 0,
            duration: 0,
            views: 0,
            sold: 0,
            buyers: 0,
            sessions: 0,
            ctrSum: 0,
            ctrCount: 0,
            ctorSum: 0,
            ctorCount: 0,
            brands: new Set(),
            platforms: new Set(),
            heroProducts: {}
          };
        }

        const item = hostMap[h];
        item.gmv += s.gmv || 0;
        item.duration += s.duration || 0;
        item.views += s.views || 0;
        item.sold += s.sold_qty || 0;
        item.buyers += s.buyer || 0;
        item.sessions++;
        item.brands.add(s.brand);
        item.platforms.add(s.platform);

        if (s.ctr > 0) { item.ctrSum += s.ctr; item.ctrCount++; }
        if (s.ctor > 0) { item.ctorSum += s.ctor; item.ctorCount++; }

        if (s.product) {
          item.heroProducts[s.product] = (item.heroProducts[s.product] || 0) + (s.sold_qty || 1);
        }
      });

      return Object.values(hostMap).map(h => {
        const gmvHour = h.duration > 0 ? h.gmv / h.duration : 0;
        const avgCtr = h.ctrCount > 0 ? h.ctrSum / h.ctrCount : 0;
        const avgCtor = h.ctorCount > 0 ? h.ctorSum / h.ctorCount : 0;
        
        // Find top selling product
        let bestProduct = 'N/A';
        let maxProdSold = 0;
        Object.entries(h.heroProducts).forEach(([prod, qty]) => {
          if (qty > maxProdSold) {
            maxProdSold = qty;
            bestProduct = prod;
          }
        });

        return {
          name: h.name,
          gmv: h.gmv,
          duration: h.duration,
          gmvHour,
          views: h.views,
          sold: h.sold,
          buyers: h.buyers,
          sessions: h.sessions,
          avgCtr,
          avgCtor,
          brands: Array.from(h.brands),
          platforms: Array.from(h.platforms),
          bestProduct
        };
      }).sort((a, b) => b.gmv - a.gmv);
    },

    getGMVTrend(sessions) {
      const daily = {};
      sessions.forEach(s => {
        const d = s.date;
        if (!daily[d]) daily[d] = { date: d, gmv: 0, duration: 0, sessions: 0 };
        daily[d].gmv += s.gmv || 0;
        daily[d].duration += s.duration || 0;
        daily[d].sessions++;
      });

      return Object.keys(daily).sort().map(d => ({
        date: d,
        label: d.substring(5), // MM-DD
        value: daily[d].gmv,
        hours: daily[d].duration,
        sessions: daily[d].sessions
      }));
    },

    getTimeSlotAnalysis(sessions) {
      const slots = {
        'Morning (08-12)': { count: 0, gmv: 0, duration: 0 },
        'Afternoon (12-16)': { count: 0, gmv: 0, duration: 0 },
        'Evening (16-20)': { count: 0, gmv: 0, duration: 0 },
        'Night (20-00)': { count: 0, gmv: 0, duration: 0 },
        'Late Night (00-08)': { count: 0, gmv: 0, duration: 0 }
      };

      sessions.forEach(s => {
        const startH = parseFloat(s.start) || 8;
        let slotKey = 'Morning (08-12)';
        if (startH >= 12 && startH < 16) slotKey = 'Afternoon (12-16)';
        else if (startH >= 16 && startH < 20) slotKey = 'Evening (16-20)';
        else if (startH >= 20 || startH === 0) slotKey = 'Night (20-00)';
        else if (startH > 0 && startH < 8) slotKey = 'Late Night (00-08)';

        slots[slotKey].count++;
        slots[slotKey].gmv += s.gmv || 0;
        slots[slotKey].duration += s.duration || 0;
      });

      return Object.entries(slots).map(([name, val]) => ({
        name,
        gmv: val.gmv,
        sessions: val.count,
        duration: val.duration,
        gmvHour: val.duration > 0 ? val.gmv / val.duration : 0
      }));
    },

    getTopProducts(sessions, limit = 10) {
      const prodMap = {};
      sessions.forEach(s => {
        if (!s.product) return;
        const p = s.product.trim();
        if (!prodMap[p]) {
          prodMap[p] = { product: p, brand: s.brand, sold: 0, gmvEst: 0, sessions: 0 };
        }
        prodMap[p].sold += s.sold_qty || 0;
        prodMap[p].gmvEst += s.gmv || 0;
        prodMap[p].sessions++;
      });

      return Object.values(prodMap).sort((a, b) => b.sold - a.sold).slice(0, limit);
    }
  };

  window.Analytics = Analytics;
})(window);
