/**
 * Livestream Performance Intelligence Platform
 * Payroll Verification & Rate Management Engine
 */

(function(window) {
  'use strict';

  const Payroll = {
    rates: {},
    rateHistory: {},
    verificationStatus: {},

    init() {
      // Load saved rates
      const savedRates = typeof localStorage !== 'undefined' ? localStorage.getItem('fyc_host_rates') : null;
      if (savedRates) {
        try { this.rates = JSON.parse(savedRates); } catch (e) {}
      } else if (window.MASTER_HOST_PROFILES) {
        window.MASTER_HOST_PROFILES.forEach(h => {
          this.rates[h.name] = h.rate || 65000;
        });
      }

      // Load rate history
      const savedHistory = typeof localStorage !== 'undefined' ? localStorage.getItem('fyc_rate_history') : null;
      if (savedHistory) {
        try { this.rateHistory = JSON.parse(savedHistory); } catch (e) {}
      } else if (window.MASTER_RATE_HISTORY) {
        this.rateHistory = JSON.parse(JSON.stringify(window.MASTER_RATE_HISTORY));
      }

      // Load statuses
      const savedStatus = typeof localStorage !== 'undefined' ? localStorage.getItem('fyc_payroll_status') : null;
      if (savedStatus) {
        try { this.verificationStatus = JSON.parse(savedStatus); } catch (e) {}
      }
    },

    getHostRate(hostName) {
      return this.rates[hostName] || 65000;
    },

    setHostRate(hostName, newRate, reason = 'Periodic Rate Adjustment', changedBy = '') {
      const oldRate = this.getHostRate(hostName);
      this.rates[hostName] = parseInt(newRate, 10);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('fyc_host_rates', JSON.stringify(this.rates));
      }

      // Append to history
      if (!this.rateHistory[hostName]) this.rateHistory[hostName] = [];
      this.rateHistory[hostName].unshift({
        date: new Date().toISOString().split('T')[0],
        old_rate: oldRate,
        new_rate: parseInt(newRate, 10),
        reason,
        changed_by: changedBy || (window.Accounts ? window.Accounts.getCurrentAccount().name : 'Admin')
      });

      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('fyc_rate_history', JSON.stringify(this.rateHistory));
      }
      if (window.SupabaseEngine && typeof window.SupabaseEngine.saveHostRate === 'function') window.SupabaseEngine.saveHostRate(hostName, newRate);
    },

    getHostRateHistory(hostName) {
      return this.rateHistory[hostName] || [];
    },

    getAllHostRates() {
      const hosts = window.MASTER_HOST_PROFILES || [];
      return hosts.map(h => ({
        name: h.name,
        tier: h.tier,
        role: h.role,
        avatarColor: h.avatar_color,
        rate: this.getHostRate(h.name),
        history: this.getHostRateHistory(h.name)
      }));
    },

    setStatus(hostName, periodKey, status) {
      const key = `${periodKey}_${hostName}`;
      this.verificationStatus[key] = status;
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('fyc_payroll_status', JSON.stringify(this.verificationStatus));
      }
    },

    getStatus(hostName, periodKey) {
      const key = `${periodKey}_${hostName}`;
      return this.verificationStatus[key] || 'Pending';
    },

    calculatePayrollSummary(hostAggregates, periodKey = 'Current') {
      let totalHoursAll = 0;
      let totalBasePayoutAll = 0;
      let totalBonusAll = 0;
      let totalFinalPayoutAll = 0;

      const items = hostAggregates.map(h => {
        const rate = this.getHostRate(h.name);
        const hours = h.duration || 0;
        const basePay = hours * rate;

        let bonus = 0;
        let bonusLabel = 'Standard';
        if (h.gmvHour >= 2000000) {
          bonus = basePay * 0.10;
          bonusLabel = '10% Tier-1 Alpha';
        } else if (h.gmvHour >= 1200000) {
          bonus = basePay * 0.05;
          bonusLabel = '5% High Performance';
        }

        const totalPay = basePay + bonus;
        const status = this.getStatus(h.name, periodKey);

        totalHoursAll += hours;
        totalBasePayoutAll += basePay;
        totalBonusAll += bonus;
        totalFinalPayoutAll += totalPay;

        return {
          name: h.name,
          hours,
          rate,
          basePay,
          bonus,
          bonusLabel,
          totalPay,
          status,
          gmv: h.gmv,
          gmvHour: h.gmvHour,
          sessions: h.sessions
        };
      });

      return {
        items,
        totalHoursAll,
        totalBasePayoutAll,
        totalBonusAll,
        totalFinalPayoutAll
      };
    }
  };

  Payroll.init();
  window.Payroll = Payroll;
})(window);
