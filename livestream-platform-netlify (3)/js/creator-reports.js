/**
 * Creator Monthly Reports
 * Builds creator-facing monthly performance reports from private session data.
 * Targets are stored in Supabase and may be overridden per host/month.
 */
(function(window, document) {
  'use strict';

  const CreatorReports = {
    brandTargets: [],
    monthlyTargets: [],
    loaded: false,
    selectedMonth: '',
    selectedHost: '',

    async load() {
      if (!window.SupabaseEngine?.isConnected || !window.SupabaseAuth?.isAuthenticated?.()) {
        this.loaded = true;
        return;
      }

      const [brandTargets, monthlyTargets] = await Promise.all([
        window.SupabaseEngine.request('brand_targets?select=*&order=display_name.asc,platform.asc'),
        window.SupabaseEngine.request('host_monthly_targets?select=*&order=month.desc,host.asc,brand.asc')
      ]);

      this.brandTargets = Array.isArray(brandTargets) ? brandTargets : [];
      this.monthlyTargets = Array.isArray(monthlyTargets) ? monthlyTargets : [];
      this.loaded = true;
    },

    escape(value) {
      const node = document.createElement('div');
      node.textContent = String(value ?? '');
      return node.innerHTML;
    },

    fmtIDR(value) {
      return 'Rp' + Math.round(Number(value || 0)).toLocaleString('id-ID');
    },

    fmtNumber(value, decimals = 1) {
      return Number(value || 0).toLocaleString('id-ID', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      });
    },

    normalizeMonth(value) {
      const raw = String(value || '');
      if (/^\d{4}-\d{2}$/.test(raw)) return raw;
      if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw.slice(0, 7);
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    },

    monthDate(month) {
      return `${this.normalizeMonth(month)}-01`;
    },

    monthLabel(month) {
      return new Date(`${this.normalizeMonth(month)}-01T12:00:00`).toLocaleDateString('id-ID', {
        month: 'long',
        year: 'numeric'
      });
    },

    monthEnd(month) {
      const [year, number] = this.normalizeMonth(month).split('-').map(Number);
      const lastDay = new Date(year, number, 0).getDate();
      return `${year}-${String(number).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    },

    nextMonth(month) {
      const [year, number] = this.normalizeMonth(month).split('-').map(Number);
      const date = new Date(year, number, 1);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    },

    getAvailableMonths() {
      return Array.from(new Set(
        (window.MASTER_SESSIONS || [])
          .map(row => String(row.date || '').slice(0, 7))
          .filter(value => /^\d{4}-\d{2}$/.test(value))
      )).sort().reverse();
    },

    getMonthSessions(month) {
      const normalized = this.normalizeMonth(month);
      return (window.MASTER_SESSIONS || []).filter(row => String(row.date || '').startsWith(normalized));
    },

    getHosts(month) {
      return Array.from(new Set(
        this.getMonthSessions(month)
          .map(row => String(row.host || '').trim())
          .filter(Boolean)
      )).sort((a, b) => a.localeCompare(b));
    },

    getBaseTarget(brand, platform) {
      return this.brandTargets.find(row =>
        String(row.brand).toLowerCase() === String(brand).toLowerCase() &&
        String(row.platform).toLowerCase() === String(platform).toLowerCase()
      ) || null;
    },

    getMonthlyTarget(month, host, brand, platform) {
      const monthDate = this.monthDate(month);
      return this.monthlyTargets.find(row =>
        String(row.month).slice(0, 10) === monthDate &&
        String(row.host).toLowerCase() === String(host).toLowerCase() &&
        String(row.brand).toLowerCase() === String(brand).toLowerCase() &&
        String(row.platform).toLowerCase() === String(platform).toLowerCase()
      ) || null;
    },

    getEffectiveTarget(month, host, brand, platform) {
      const override = this.getMonthlyTarget(month, host, brand, platform);
      const base = this.getBaseTarget(brand, platform);
      return {
        targetPerHour: Number(override?.target_per_hour ?? base?.target_per_hour ?? 0),
        source: override?.source || 'base',
        adjustmentPct: Number(override?.adjustment_pct || 0),
        previousAchievement: override?.previous_achievement == null ? null : Number(override.previous_achievement),
        plannedHours: override?.planned_hours == null ? null : Number(override.planned_hours),
        base
      };
    },

    getAdjustmentPct(achievement) {
      const value = Number(achievement || 0);
      if (value < 50) return -15;
      if (value < 70) return -8;
      if (value < 90) return 0;
      if (value < 110) return 8;
      return 15;
    },

    roundTarget(value) {
      const numeric = Math.max(0, Number(value || 0));
      return Math.round(numeric / 10000) * 10000;
    },

    getAchievementTone(value) {
      if (value == null) return 'neutral';
      if (value >= 100) return 'excellent';
      if (value >= 90) return 'good';
      if (value >= 70) return 'watch';
      return 'low';
    },

    buildReport(host, month) {
      const sessions = this.getMonthSessions(month).filter(row =>
        String(row.host || '').toLowerCase() === String(host || '').toLowerCase()
      );

      const grouped = new Map();
      const daily = new Map();

      sessions.forEach(row => {
        const brand = String(row.brand || 'Unknown');
        const platform = String(row.platform || 'Unknown');
        const key = `${brand}||${platform}`;
        if (!grouped.has(key)) {
          grouped.set(key, {
            brand,
            platform,
            sessions: 0,
            duration: 0,
            gmv: 0,
            sold: 0
          });
        }

        const group = grouped.get(key);
        group.sessions += 1;
        group.duration += Number(row.duration || 0);
        group.gmv += Number(row.gmv || 0);
        group.sold += Number(row.sold_qty || 0);

        const dayKey = `${row.date}||${brand}||${platform}`;
        if (!daily.has(dayKey)) {
          daily.set(dayKey, {
            date: row.date,
            brand,
            platform,
            duration: 0,
            gmv: 0,
            sessions: 0
          });
        }
        const day = daily.get(dayKey);
        day.duration += Number(row.duration || 0);
        day.gmv += Number(row.gmv || 0);
        day.sessions += 1;
      });

      const lines = Array.from(grouped.values()).map(group => {
        const effective = this.getEffectiveTarget(month, host, group.brand, group.platform);
        const target = group.duration * effective.targetPerHour;
        const achievement = target > 0 ? (group.gmv / target) * 100 : null;
        const base = effective.base;
        const adjustmentPct = !base || effective.targetPerHour <= 0 || base?.auto_adjust_enabled === false || base?.status === 'off'
          ? 0
          : this.getAdjustmentPct(achievement);
        const suggestedTargetPerHour = effective.targetPerHour > 0
          ? this.roundTarget(effective.targetPerHour * (1 + adjustmentPct / 100))
          : 0;

        return {
          ...group,
          ...effective,
          target,
          achievement,
          adjustmentPct,
          suggestedTargetPerHour,
          displayName: base?.display_name || group.brand,
          status: base?.status || 'active',
          notes: base?.notes || '',
          recommendedMin: Number(base?.recommended_hours_min || 0),
          recommendedMax: Number(base?.recommended_hours_max || 0)
        };
      }).sort((a, b) => b.gmv - a.gmv);

      const dailyRows = Array.from(daily.values()).map(day => {
        const effective = this.getEffectiveTarget(month, host, day.brand, day.platform);
        const target = day.duration * effective.targetPerHour;
        return {
          ...day,
          targetPerHour: effective.targetPerHour,
          target,
          achievement: target > 0 ? (day.gmv / target) * 100 : null,
          displayName: effective.base?.display_name || day.brand
        };
      }).sort((a, b) => {
        const dateSort = String(a.date).localeCompare(String(b.date));
        return dateSort || a.displayName.localeCompare(b.displayName);
      });

      const totalHours = lines.reduce((sum, row) => sum + row.duration, 0);
      const totalGMV = lines.reduce((sum, row) => sum + row.gmv, 0);
      const totalTarget = lines.reduce((sum, row) => sum + row.target, 0);
      const totalSold = lines.reduce((sum, row) => sum + row.sold, 0);
      const achievement = totalTarget > 0 ? (totalGMV / totalTarget) * 100 : null;
      const rate = Number(window.Payroll?.getHostRate?.(host) || 0);
      const payment = totalHours * rate;

      return {
        host,
        month: this.normalizeMonth(month),
        monthLabel: this.monthLabel(month),
        cutoff: `${this.monthEnd(month)} 23:59`,
        sessions,
        lines,
        dailyRows,
        totalHours,
        totalGMV,
        totalTarget,
        totalSold,
        achievement,
        rate,
        payment
      };
    },

    getStatusCopy(achievement) {
      if (achievement == null) {
        return {
          label: 'No target',
          text: 'Target belum aktif untuk periode ini.'
        };
      }
      if (achievement >= 110) {
        return {
          label: 'Outstanding',
          text: 'Performa melewati target secara signifikan. Target bulan berikutnya dapat dinaikkan.'
        };
      }
      if (achievement >= 90) {
        return {
          label: 'On Track',
          text: 'Performa sudah berada di jalur target dan cukup stabil.'
        };
      }
      if (achievement >= 70) {
        return {
          label: 'Developing',
          text: 'Performa cukup baik, namun masih ada ruang untuk mengejar target.'
        };
      }
      return {
        label: 'Needs Focus',
        text: 'Achievement masih di bawah target dan perlu evaluasi strategi live berikutnya.'
      };
    },

    async saveBrandTargets(rows) {
      if (!rows.length) return;
      await window.SupabaseEngine.request('brand_targets?on_conflict=brand,platform', {
        method: 'POST',
        prefer: 'resolution=merge-duplicates,return=representation',
        body: JSON.stringify(rows)
      });
      await this.load();
    },

    async saveMonthlyOverride(payload) {
      await window.SupabaseEngine.request('host_monthly_targets?on_conflict=month,host,brand,platform', {
        method: 'POST',
        prefer: 'resolution=merge-duplicates,return=representation',
        body: JSON.stringify(payload)
      });
      await this.load();
    },

    async applyRecommendations(report) {
      const current = window.Accounts?.getCurrentAccount?.();
      if (!current?.canManageRates && !current?.canManageAccounts) {
        throw new Error('Target adjustment requires Rates or Admin permission.');
      }

      const next = this.nextMonth(report.month);
      const userId = window.SupabaseAuth?.getUser?.()?.id || null;
      const payload = report.lines
        .filter(line => line.status !== 'off' && line.targetPerHour > 0)
        .map(line => ({
          month: `${next}-01`,
          host: report.host,
          brand: line.brand,
          platform: line.platform,
          target_per_hour: line.suggestedTargetPerHour,
          planned_hours: null,
          source: 'auto',
          adjustment_pct: line.adjustmentPct,
          previous_achievement: line.achievement,
          notes: `Auto recommendation from ${report.monthLabel}`,
          created_by: userId,
          updated_at: new Date().toISOString()
        }));

      if (!payload.length) throw new Error('Tidak ada target aktif yang bisa direkomendasikan.');

      await window.SupabaseEngine.request('host_monthly_targets?on_conflict=month,host,brand,platform', {
        method: 'POST',
        prefer: 'resolution=merge-duplicates,return=minimal',
        body: JSON.stringify(payload)
      });
      await this.load();
      return next;
    },

    ensureSelection() {
      const months = this.getAvailableMonths();
      if (!this.selectedMonth || !months.includes(this.selectedMonth)) {
        this.selectedMonth = months[0] || this.normalizeMonth('');
      }

      const hosts = this.getHosts(this.selectedMonth);
      if (!this.selectedHost || !hosts.includes(this.selectedHost)) {
        this.selectedHost = hosts[0] || '';
      }
      return { months, hosts };
    }
  };

  window.CreatorReports = CreatorReports;

  if (!window.App) return;

  Object.assign(window.App, {
    renderCreatorReportsView(container) {
      const { months, hosts } = CreatorReports.ensureSelection();
      const currentAcc = Accounts.getCurrentAccount();
      const canManageTargets = !!(currentAcc?.canManageRates || currentAcc?.canManageAccounts);

      if (!CreatorReports.selectedHost) {
        container.innerHTML = `
          <div class="empty-filter-state">
            <div class="empty-icon">📄</div>
            <h3>Belum ada data creator report</h3>
            <p>Session data untuk periode yang dipilih belum tersedia.</p>
          </div>
        `;
        return;
      }

      const report = CreatorReports.buildReport(CreatorReports.selectedHost, CreatorReports.selectedMonth);
      const status = CreatorReports.getStatusCopy(report.achievement);
      const achievementText = report.achievement == null ? '—' : `${report.achievement.toFixed(1)}%`;
      const tone = CreatorReports.getAchievementTone(report.achievement);
      const nextMonth = CreatorReports.nextMonth(report.month);

      container.innerHTML = `
        <div class="creator-report-toolbar no-print">
          <div>
            <span class="creator-report-eyebrow">Monthly Creator Reporting</span>
            <h2 class="view-title">Creator Monthly Report</h2>
            <p class="view-subtitle">Creator-facing recap otomatis dari live session, GMV, target, achievement, dan hourly payment.</p>
          </div>

          <div class="creator-report-toolbar-actions">
            <select class="select-filter" id="creator-report-month" aria-label="Report month">
              ${months.map(month => `<option value="${month}" ${month === report.month ? 'selected' : ''}>${CreatorReports.monthLabel(month)}</option>`).join('')}
            </select>
            <select class="select-filter" id="creator-report-host" aria-label="Host">
              ${hosts.map(host => `<option value="${CreatorReports.escape(host)}" ${host === report.host ? 'selected' : ''}>${CreatorReports.escape(host)}</option>`).join('')}
            </select>
            ${canManageTargets ? '<button class="apple-btn apple-btn-secondary" data-app-action="openBrandTargetSettings">Target Settings</button>' : ''}
            <button class="apple-btn apple-btn-secondary" data-app-action="copyCreatorReportSummary">Copy Summary</button>
            <button class="apple-btn apple-btn-primary" data-app-action="printCreatorReport">Print / Save PDF</button>
          </div>
        </div>

        <section class="creator-report-sheet" id="creator-report-sheet">
          <div class="creator-report-cover">
            <div class="creator-report-brand">
              <img src="assets/fyc-logo.svg" alt="FYC" />
              <div>
                <span>FYC Live Operations</span>
                <strong>Laporan Performa Bulanan</strong>
              </div>
            </div>
            <div class="creator-report-period">
              <span>PERIODE</span>
              <strong>${report.monthLabel}</strong>
              <small>Cut-off ${report.cutoff}</small>
            </div>
          </div>

          <div class="creator-report-hero">
            <div>
              <span class="creator-report-kicker">CREATOR / HOST</span>
              <h1>${CreatorReports.escape(report.host)}</h1>
              <p>Ringkasan performa live bulanan berdasarkan seluruh session yang tercatat sampai cut-off periode.</p>
            </div>
            <div class="creator-achievement-ring ${tone}">
              <span>Achievement</span>
              <strong>${achievementText}</strong>
              <small>${status.label}</small>
            </div>
          </div>

          <div class="creator-summary-grid">
            <article>
              <span>Total Jam Live</span>
              <strong>${CreatorReports.fmtNumber(report.totalHours)}h</strong>
              <small>${report.sessions.length.toLocaleString('id-ID')} live sessions</small>
            </article>
            <article>
              <span>Total GMV</span>
              <strong>${CreatorReports.fmtIDR(report.totalGMV)}</strong>
              <small>${report.totalSold.toLocaleString('id-ID')} units sold</small>
            </article>
            <article>
              <span>Target GMV</span>
              <strong>${CreatorReports.fmtIDR(report.totalTarget)}</strong>
              <small>Jam aktual × target/jam</small>
            </article>
            <article>
              <span>Estimasi Pembayaran</span>
              <strong>${CreatorReports.fmtIDR(report.payment)}</strong>
              <small>${CreatorReports.fmtIDR(report.rate)}/jam × ${CreatorReports.fmtNumber(report.totalHours)}h</small>
            </article>
          </div>

          <div class="creator-performance-note ${tone}">
            <div>
              <span class="creator-performance-dot"></span>
              <strong>${status.label}</strong>
            </div>
            <p>${status.text}</p>
          </div>

          <div class="creator-report-section">
            <div class="creator-report-section-head">
              <div>
                <span>01</span>
                <div>
                  <h3>Brand Performance</h3>
                  <p>Target dihitung dari jam live aktual × target per jam masing-masing brand/platform.</p>
                </div>
              </div>
            </div>

            <div class="table-responsive">
              <table class="creator-report-table">
                <thead>
                  <tr>
                    <th>Brand</th>
                    <th>Platform</th>
                    <th>Jam Live</th>
                    <th>Target / Jam</th>
                    <th>Target Bulanan</th>
                    <th>GMV Actual</th>
                    <th>Achievement</th>
                  </tr>
                </thead>
                <tbody>
                  ${report.lines.map(line => `
                    <tr>
                      <td>
                        <strong>${CreatorReports.escape(line.displayName)}</strong>
                        ${line.notes ? `<small>${CreatorReports.escape(line.notes)}</small>` : ''}
                      </td>
                      <td><span class="platform-report-badge ${String(line.platform).toLowerCase()}">${CreatorReports.escape(line.platform)}</span></td>
                      <td>${CreatorReports.fmtNumber(line.duration)}h</td>
                      <td>
                        ${CreatorReports.fmtIDR(line.targetPerHour)}
                        ${line.source !== 'base' ? `<small class="target-source">${CreatorReports.escape(line.source)}</small>` : ''}
                      </td>
                      <td>${CreatorReports.fmtIDR(line.target)}</td>
                      <td><strong>${CreatorReports.fmtIDR(line.gmv)}</strong></td>
                      <td>
                        <span class="achievement-pill ${CreatorReports.getAchievementTone(line.achievement)}">
                          ${line.achievement == null ? 'N/A' : line.achievement.toFixed(1) + '%'}
                        </span>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>

          <div class="creator-report-section creator-daily-section">
            <div class="creator-report-section-head">
              <div>
                <span>02</span>
                <div>
                  <h3>Daily Live Recap</h3>
                  <p>Detail live harian per brand untuk transparansi report.</p>
                </div>
              </div>
            </div>

            <div class="table-responsive">
              <table class="creator-report-table creator-daily-table">
                <thead>
                  <tr>
                    <th>Tanggal</th>
                    <th>Brand</th>
                    <th>Platform</th>
                    <th>Jam</th>
                    <th>Target</th>
                    <th>GMV</th>
                    <th>Achievement</th>
                  </tr>
                </thead>
                <tbody>
                  ${report.dailyRows.map(day => `
                    <tr>
                      <td>${new Date(day.date + 'T12:00:00').toLocaleDateString('id-ID', {day:'2-digit',month:'short'})}</td>
                      <td>${CreatorReports.escape(day.displayName)}</td>
                      <td>${CreatorReports.escape(day.platform)}</td>
                      <td>${CreatorReports.fmtNumber(day.duration)}h</td>
                      <td>${CreatorReports.fmtIDR(day.target)}</td>
                      <td>${CreatorReports.fmtIDR(day.gmv)}</td>
                      <td>${day.achievement == null ? '—' : day.achievement.toFixed(1) + '%'}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>

          <div class="creator-report-payment">
            <div>
              <span>Hourly Rate</span>
              <strong>${CreatorReports.fmtIDR(report.rate)}</strong>
            </div>
            <div>
              <span>Total Live Hours</span>
              <strong>${CreatorReports.fmtNumber(report.totalHours)} jam</strong>
            </div>
            <div class="creator-payment-total">
              <span>Estimasi Pembayaran</span>
              <strong>${CreatorReports.fmtIDR(report.payment)}</strong>
              <small>Belum termasuk penyesuaian/bonus manual apabila ada.</small>
            </div>
          </div>

          <footer class="creator-report-footer">
            <div>
              <img src="assets/fyc-logo.svg" alt="FYC" />
              <span>FYC Live Operations</span>
            </div>
            <p>Report generated from verified live operations data · Cut-off ${report.cutoff}</p>
          </footer>
        </section>

        ${canManageTargets ? `
          <section class="creator-internal-panel no-print">
            <div class="creator-internal-head">
              <div>
                <span>INTERNAL ONLY</span>
                <h3>Target Recommendation · ${CreatorReports.monthLabel(nextMonth)}</h3>
                <p>Auto recommendation dibatasi ±15% berdasarkan achievement bulan ini. Semua angka tetap bisa dioverride manual.</p>
              </div>
              <button class="apple-btn apple-btn-primary" data-app-action="applyCreatorTargetRecommendations">Apply All to Next Month</button>
            </div>

            <div class="target-recommendation-grid">
              ${report.lines.map(line => `
                <article>
                  <div class="target-rec-title">
                    <div>
                      <strong>${CreatorReports.escape(line.displayName)}</strong>
                      <span>${CreatorReports.escape(line.platform)}</span>
                    </div>
                    <span class="target-adjustment ${line.adjustmentPct > 0 ? 'up' : line.adjustmentPct < 0 ? 'down' : 'flat'}">
                      ${line.adjustmentPct > 0 ? '+' : ''}${line.adjustmentPct}%
                    </span>
                  </div>
                  <div class="target-rec-values">
                    <div><span>Current</span><strong>${CreatorReports.fmtIDR(line.targetPerHour)}/h</strong></div>
                    <div><span>Suggested</span><strong>${CreatorReports.fmtIDR(line.suggestedTargetPerHour)}/h</strong></div>
                  </div>
                  <div class="target-rec-footer">
                    <span>Achievement ${line.achievement == null ? 'N/A' : line.achievement.toFixed(1) + '%'}</span>
                    <button class="apple-btn apple-btn-secondary compact-btn"
                      data-app-action="openCreatorTargetOverride"
                      data-app-arg="${encodeURIComponent(JSON.stringify({
                        month: report.month,
                        host: report.host,
                        brand: line.brand,
                        platform: line.platform
                      }))}">
                      Override
                    </button>
                  </div>
                </article>
              `).join('')}
            </div>
          </section>
        ` : ''}
      `;

      document.getElementById('creator-report-month')?.addEventListener('change', event => {
        CreatorReports.selectedMonth = event.target.value;
        CreatorReports.selectedHost = '';
        this.renderCurrentView();
      });

      document.getElementById('creator-report-host')?.addEventListener('change', event => {
        CreatorReports.selectedHost = event.target.value;
        this.renderCurrentView();
      });
    },

    printCreatorReport() {
      document.body.classList.add('creator-report-printing');
      window.print();
      window.setTimeout(() => document.body.classList.remove('creator-report-printing'), 350);
    },

    async copyCreatorReportSummary() {
      const report = CreatorReports.buildReport(CreatorReports.selectedHost, CreatorReports.selectedMonth);
      const lines = [
        `FYC Monthly Creator Report — ${report.monthLabel}`,
        `Host: ${report.host}`,
        `Total Jam Live: ${CreatorReports.fmtNumber(report.totalHours)} jam`,
        `Total GMV: ${CreatorReports.fmtIDR(report.totalGMV)}`,
        `Target GMV: ${CreatorReports.fmtIDR(report.totalTarget)}`,
        `Achievement: ${report.achievement == null ? 'N/A' : report.achievement.toFixed(1) + '%'}`,
        `Estimasi Pembayaran: ${CreatorReports.fmtIDR(report.payment)}`,
        '',
        'Brand Breakdown:',
        ...report.lines.map(line =>
          `- ${line.displayName} (${line.platform}): ${CreatorReports.fmtNumber(line.duration)}h | GMV ${CreatorReports.fmtIDR(line.gmv)} | Target ${CreatorReports.fmtIDR(line.target)} | ${line.achievement == null ? 'N/A' : line.achievement.toFixed(1) + '%'}`
        )
      ];

      await navigator.clipboard.writeText(lines.join('\n'));
      window.UI?.toast?.('Creator report summary copied.', 'success');
    },

    async applyCreatorTargetRecommendations() {
      const report = CreatorReports.buildReport(CreatorReports.selectedHost, CreatorReports.selectedMonth);
      const nextMonth = await window.UI.withBusy(
        () => CreatorReports.applyRecommendations(report),
        'Applying next-month targets…'
      );
      window.UI?.toast?.(`Target recommendation untuk ${CreatorReports.monthLabel(nextMonth)} sudah disimpan.`, 'success');
      this.renderCurrentView();
    },

    openCreatorTargetOverride(encoded) {
      const data = JSON.parse(decodeURIComponent(encoded));
      const effective = CreatorReports.getEffectiveTarget(data.month, data.host, data.brand, data.platform);
      const base = effective.base;
      const modal = document.getElementById('generic-modal');
      const content = document.getElementById('modal-inner-content');
      if (!modal || !content) return;

      content.innerHTML = `
        <div class="secure-account-form-head">
          <span class="auth-security-pill">Monthly Override</span>
          <h3 class="modal-title">${CreatorReports.escape(base?.display_name || data.brand)} · ${CreatorReports.escape(data.platform)}</h3>
          <p>${CreatorReports.escape(data.host)} · ${CreatorReports.monthLabel(data.month)}</p>
        </div>

        <form id="creator-target-override-form" class="form-stack">
          <div>
            <label class="form-label">Target per Jam</label>
            <input class="select-filter full-width" id="creator-override-tph" type="number" min="0" step="10000" value="${Math.round(effective.targetPerHour)}" required />
            <span class="helper-text">Target bulanan report otomatis = jam live aktual × target per jam ini.</span>
          </div>
          <div>
            <label class="form-label">Planned Hours (optional)</label>
            <input class="select-filter full-width" id="creator-override-hours" type="number" min="0" step="0.5" value="${effective.plannedHours ?? ''}" placeholder="Optional" />
          </div>
          <div>
            <label class="form-label">Notes</label>
            <input class="select-filter full-width" id="creator-override-notes" type="text" maxlength="180" placeholder="Reason for manual target adjustment" />
          </div>
          <div class="form-actions">
            <button type="button" class="apple-btn apple-btn-secondary" data-app-action="closeModal">Cancel</button>
            <button type="submit" class="apple-btn apple-btn-primary">Save Override</button>
          </div>
        </form>
      `;

      document.getElementById('creator-target-override-form')?.addEventListener('submit', async event => {
        event.preventDefault();
        const tph = Number(document.getElementById('creator-override-tph').value || 0);
        const planned = document.getElementById('creator-override-hours').value;
        const notes = document.getElementById('creator-override-notes').value.trim();

        await window.UI.withBusy(
          () => CreatorReports.saveMonthlyOverride({
            month: `${data.month}-01`,
            host: data.host,
            brand: data.brand,
            platform: data.platform,
            target_per_hour: tph,
            planned_hours: planned === '' ? null : Number(planned),
            source: 'manual',
            adjustment_pct: 0,
            previous_achievement: null,
            notes,
            created_by: window.SupabaseAuth?.getUser?.()?.id || null,
            updated_at: new Date().toISOString()
          }),
          'Saving target override…'
        );

        this.closeModal();
        window.UI?.toast?.('Monthly target override saved.', 'success');
        this.renderCurrentView();
      });

      modal.classList.add('active');
    },

    openBrandTargetSettings() {
      const modal = document.getElementById('generic-modal');
      const content = document.getElementById('modal-inner-content');
      if (!modal || !content) return;

      content.innerHTML = `
        <div class="secure-account-form-head">
          <span class="auth-security-pill">Master Target Engine</span>
          <h3 class="modal-title">Brand Target Settings</h3>
          <p>Target dasar per sesi 2 jam, target/jam, rekomendasi jam harian, dan status brand.</p>
        </div>

        <form id="brand-target-settings-form" class="form-stack">
          <div class="target-settings-list">
            ${CreatorReports.brandTargets.map((row, index) => `
              <div class="target-settings-row" data-target-index="${index}">
                <div class="target-settings-brand">
                  <strong>${CreatorReports.escape(row.display_name)}</strong>
                  <span>${CreatorReports.escape(row.brand)} · ${CreatorReports.escape(row.platform)}</span>
                </div>
                <label>
                  <span>Target / 2h</span>
                  <input type="number" min="0" step="10000" data-field="target_per_session" value="${Number(row.target_per_session || 0)}" />
                </label>
                <label>
                  <span>Target / jam</span>
                  <input type="number" min="0" step="10000" data-field="target_per_hour" value="${Number(row.target_per_hour || 0)}" readonly title="Automatically derived from target per 2-hour session" />
                </label>
                <label>
                  <span>Jam / hari</span>
                  <div class="hours-range-inputs">
                    <input type="number" min="0" step="1" data-field="recommended_hours_min" value="${Number(row.recommended_hours_min || 0)}" />
                    <span>–</span>
                    <input type="number" min="0" step="1" data-field="recommended_hours_max" value="${Number(row.recommended_hours_max || 0)}" />
                  </div>
                </label>
                <label>
                  <span>Status</span>
                  <select data-field="status">
                    <option value="active" ${row.status === 'active' ? 'selected' : ''}>Active</option>
                    <option value="event" ${row.status === 'event' ? 'selected' : ''}>Event</option>
                    <option value="off" ${row.status === 'off' ? 'selected' : ''}>Off</option>
                  </select>
                </label>
              </div>
            `).join('')}
          </div>

          <div class="form-actions">
            <button type="button" class="apple-btn apple-btn-secondary" data-app-action="closeModal">Cancel</button>
            <button type="submit" class="apple-btn apple-btn-primary">Save Master Targets</button>
          </div>
        </form>
      `;

      document.getElementById('brand-target-settings-form')?.addEventListener('submit', async event => {
        event.preventDefault();

        const rows = CreatorReports.brandTargets.map((row, index) => {
          const root = content.querySelector(`[data-target-index="${index}"]`);
          const value = field => root.querySelector(`[data-field="${field}"]`)?.value;
          return {
            ...row,
            target_per_session: Number(value('target_per_session') || 0),
            target_per_hour: Number(value('target_per_session') || 0) / Math.max(1, Number(row.session_hours || 2)),
            recommended_hours_min: Number(value('recommended_hours_min') || 0),
            recommended_hours_max: Number(value('recommended_hours_max') || 0),
            status: value('status') || 'active',
            updated_at: new Date().toISOString()
          };
        });

        await window.UI.withBusy(() => CreatorReports.saveBrandTargets(rows), 'Saving master targets…');
        this.closeModal();
        window.UI?.toast?.('Brand target settings updated.', 'success');
        this.renderCurrentView();
      });

      modal.classList.add('active');
    }
  });
})(window, document);
