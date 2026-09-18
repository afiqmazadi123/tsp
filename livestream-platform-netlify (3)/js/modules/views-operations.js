/**
 * Extracted from app.js — payroll, assessments, and reports views
 */
(function(window) {
  'use strict';
  const App = window.App;
  if (!App) return;

  Object.assign(App, {
    // 5. PAYROLL VERIFICATION VIEW
    renderPayrollView(container, data) {
      const { hostAggs } = data;
      const payrollSummary = Payroll.calculatePayrollSummary(hostAggs, '2026-09');

      container.innerHTML = `
        <div class="view-header">
          <div>
            <h2 class="view-title">Creator Payroll Validation & Settlement</h2>
            <p class="view-subtitle">Formula: Approved Live Hours × Applicable Rate + Performance Milestone Incentive</p>
          </div>
          <div class="action-row">
            <button class="apple-btn apple-btn-secondary" data-app-action="approveAllPayroll">Approve All</button>
            <button class="apple-btn apple-btn-primary" data-app-action="exportPayrollCSV">Export Payroll CSV</button>
          </div>
        </div>

        <div class="kpi-grid">
          <div class="glass-card kpi-card">
            <span class="kpi-label">Total Payroll Payout</span>
            <div class="kpi-value" style="color:var(--apple-green)">${AppleCharts.formatIDRShort(payrollSummary.totalFinalPayoutAll)}</div>
            <div class="kpi-meta">Base: ${AppleCharts.formatIDRShort(payrollSummary.totalBasePayoutAll)} + Bonus</div>
          </div>
          <div class="glass-card kpi-card">
            <span class="kpi-label">Total Approved Live Hours</span>
            <div class="kpi-value">${payrollSummary.totalHoursAll.toFixed(0)} <span class="metric-unit">hrs</span></div>
            <div class="kpi-meta">Across 15 creators</div>
          </div>
          <div class="glass-card kpi-card">
            <span class="kpi-label">Total Performance Incentive</span>
            <div class="kpi-value" style="color:var(--apple-yellow)">${AppleCharts.formatIDRShort(payrollSummary.totalBonusAll)}</div>
            <div class="kpi-meta">Top conversion bonuses</div>
          </div>
        </div>

        <div class="glass-card">
          <div class="card-header">
            <div class="card-title-group">
              <h3>Monthly Host Payroll Verification</h3>
              <p>Period: July - September 2026 Settlement</p>
            </div>
          </div>

          <div class="table-responsive">
            <table class="apple-table" data-sortable="true">
              <thead>
                <tr>
                  <th>Host</th>
                  <th>Approved Hours</th>
                  <th>Hourly Rate</th>
                  <th>Base Pay</th>
                  <th>Incentive / Bonus</th>
                  <th>Total Payment</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                ${payrollSummary.items.map(p => `
                  <tr>
                    <td><strong>${p.name}</strong></td>
                    <td>${p.hours.toFixed(1)} hrs (${p.sessions} shifts)</td>
                    <td>
                      <span style="font-weight:600">${AppleCharts.formatIDR(p.rate)}</span>/hr
                      <button class="apple-btn apple-btn-secondary" style="padding:1px 6px;font-size:10px;margin-left:6px" data-app-action="openAdjustRateModal" data-app-arg="${p.name}">Edit</button>
                    </td>
                    <td>${AppleCharts.formatIDR(p.basePay)}</td>
                    <td>
                      <span style="color:var(--apple-yellow);font-weight:600">${AppleCharts.formatIDR(p.bonus)}</span>
                      <div class="meta-xs">${p.bonusLabel}</div>
                    </td>
                    <td style="font-size:14px;font-weight:700;color:var(--apple-green)">${AppleCharts.formatIDR(p.totalPay)}</td>
                    <td>
                      <span class="tier-badge" style="background:${p.status === 'Approved' ? 'rgba(48, 209, 88, 0.2)' : (p.status === 'Paid' ? 'rgba(0, 113, 227, 0.2)' : 'rgba(255, 159, 10, 0.2)')};color:${p.status === 'Approved' ? 'var(--apple-green)' : (p.status === 'Paid' ? 'var(--apple-cyan)' : 'var(--apple-orange)')}">
                        ${p.status}
                      </span>
                    </td>
                    <td>
                      <button class="apple-btn apple-btn-secondary compact-btn" data-app-action="toggleHostPayrollStatus" data-app-arg="${p.name}">
                        ${p.status === 'Approved' ? 'Mark Paid' : (p.status === 'Paid' ? 'Reset' : 'Approve')}
                      </button>
                      <button class="apple-btn apple-btn-secondary compact-btn" data-app-action="openPayrollSlipModal" data-app-arg="${p.name}">Slip</button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    },

    // 6. ASSESSMENT & SCORING ENGINE VIEW
    renderAssessmentView(container, data) {
      const { scoredHosts } = data;
      const weights = Scoring.weights;
      const currentAcc = Accounts.getCurrentAccount();
      const assessmentMonth = this.assessmentMonth || Scoring.getCurrentMonth();
      const assessmentCycle = this.assessmentCycle || Scoring.getCycleForDate();
      const cycleLabel = Scoring.getCycleLabel(assessmentCycle);
      const cycleDateLabel = Scoring.getCycleDateLabel(assessmentMonth, assessmentCycle);

      const availableMonths = Array.from(new Set(
        (window.MASTER_SESSIONS || [])
          .map(session => String(session.date || '').slice(0, 7))
          .filter(Boolean)
      )).sort().reverse();
      if (!availableMonths.includes(assessmentMonth)) availableMonths.unshift(assessmentMonth);

      const monthReviews = Scoring.getReviewsForMonth(assessmentMonth);
      const cycleReviews = Scoring.getReviewsForCycle(assessmentMonth, assessmentCycle);
      const myMonthReviews = Scoring.getReviewsByReviewer(currentAcc.name, assessmentMonth);
      const myCycleReviews = Scoring.getReviewsByReviewer(currentAcc.name, assessmentMonth, assessmentCycle);
      const myEvaluatedHostNames = new Set(myCycleReviews.map(r => r.host.toLowerCase()));
      const totalHostsCount = scoredHosts.length;
      const evaluatedCount = myEvaluatedHostNames.size;
      const pendingCount = Math.max(0, totalHostsCount - evaluatedCount);

      let displayedReviews = monthReviews;
      if (this.assessmentFilterReviewer !== 'all') {
        displayedReviews = monthReviews.filter(r => r.reviewer.toLowerCase() === this.assessmentFilterReviewer.toLowerCase());
      }

      const monthLabel = new Date(`${assessmentMonth}-01T12:00:00`).toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric'
      });

      container.innerHTML = `
        <div class="view-header">
          <div>
            <h2 class="view-title">Multi-Reviewer Assessment & Scoring Engine</h2>
            <p class="view-subtitle">Two review cycles per month. Each PIC is averaged first, then PIC averages are combined into the host assessment score.</p>
          </div>
          <div class="action-row">
            <button class="apple-btn apple-btn-secondary" data-app-action="openAccountSwitcherModal">My Profile (${currentAcc.name})</button>
            <button class="apple-btn apple-btn-primary" data-app-action="openAddReviewModal">+ Grade Host</button>
          </div>
        </div>

        <div class="assessment-period-panel">
          <div>
            <span class="assessment-period-eyebrow">Assessment Period</span>
            <div class="assessment-period-title">${monthLabel}</div>
            <p>Mid-Month covers day 1–15. End-Month covers day 16 through the last day of the month.</p>
          </div>
          <div class="assessment-period-controls">
            <select class="select-filter" data-assessment-month="true" aria-label="Assessment month">
              ${availableMonths.map(month => {
                const label = new Date(`${month}-01T12:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                return `<option value="${month}" ${month === assessmentMonth ? 'selected' : ''}>${label}</option>`;
              }).join('')}
            </select>
            <div class="assessment-cycle-toggle" role="group" aria-label="Assessment cycle">
              <button class="${assessmentCycle === 'mid_month' ? 'active' : ''}" data-app-action="setAssessmentCycle" data-app-arg="mid_month">
                Mid-Month
                <small>1–15</small>
              </button>
              <button class="${assessmentCycle === 'end_month' ? 'active' : ''}" data-app-action="setAssessmentCycle" data-app-arg="end_month">
                End-Month
                <small>16–EOM</small>
              </button>
            </div>
          </div>
        </div>

        <div class="evaluator-progress-banner" style="margin-bottom:16px;">
          <div style="display:flex;align-items:center;gap:14px;">
            <div class="user-avatar" style="background:${currentAcc.avatarColor};width:44px;height:44px;font-size:16px;">
              ${currentAcc.initials}
            </div>
            <div>
              <div style="font-size:14.5px;font-weight:700;color:var(--text-primary)">
                Reviewer: ${currentAcc.name} (${currentAcc.role})
              </div>
              <div style="font-size:12px;color:var(--text-secondary);margin-top:2px;">
                <strong>${cycleLabel} · day ${cycleDateLabel}</strong> — you have evaluated <strong>${evaluatedCount} of ${totalHostsCount} creators</strong> in this cycle (${pendingCount} pending).
              </div>
            </div>
          </div>
          <div style="display:flex;gap:8px;">
            <button class="apple-btn apple-btn-secondary" style="font-size:11.5px;padding:5px 12px;" data-app-action="filterReviewsByReviewer" data-app-arg="${currentAcc.name}">
              My ${monthLabel} Reviews (${myMonthReviews.length})
            </button>
            <button class="apple-btn apple-btn-secondary" style="font-size:11.5px;padding:5px 12px;" data-app-action="filterReviewsByReviewer" data-app-arg="all">
              All ${monthLabel} Reviews (${monthReviews.length})
            </button>
          </div>
        </div>

        <div class="glass-card">
          <div class="card-header">
            <div class="card-title-group">
              <h3>Configurable Scoring Engine Weights</h3>
              <p>Drag sliders to dynamically rebalance team performance scoring</p>
            </div>
            <button class="apple-btn apple-btn-secondary" data-app-action="resetDefaultWeights">Reset Defaults</button>
          </div>

          <div class="scoring-config-panel">
            <div class="slider-group">
              <div class="weight-group-heading">
                <h4 style="color:var(--apple-cyan)">Overall Weight Split</h4>
                <span class="weight-total-badge">Linked · 100%</span>
              </div>
              <div class="slider-item">
                <div class="slider-item-header">
                  <span>Quantitative Performance</span>
                  <span id="label-w-perf">${weights.overall.performance}%</span>
                </div>
                <input type="range" min="10" max="90" value="${weights.overall.performance}" class="apple-slider" id="slider-w-perf" data-weight-section="overall" data-weight-key="performance" />
              </div>
              <div class="slider-item">
                <div class="slider-item-header">
                  <span>Qualitative Assessment</span>
                  <span id="label-w-assess">${weights.overall.assessment}%</span>
                </div>
                <input type="range" min="10" max="90" value="${weights.overall.assessment}" class="apple-slider" id="slider-w-assess" data-weight-section="overall" data-weight-key="assessment" />
              </div>
            </div>

            <div class="slider-group">
              <div class="weight-group-heading">
                <h4 style="color:var(--apple-purple)">Performance Metrics Weight</h4>
                <span class="weight-total-badge">Linked · 100%</span>
              </div>
              <div class="slider-item">
                <div class="slider-item-header"><span>GMV Volume</span><span id="label-pw-gmv">${weights.performance.gmv}%</span></div>
                <input type="range" min="5" max="90" value="${weights.performance.gmv}" class="apple-slider" data-weight-section="performance" data-weight-key="gmv" />
              </div>
              <div class="slider-item">
                <div class="slider-item-header"><span>GMV / Hour Productivity</span><span id="label-pw-gmvhr">${weights.performance.gmv_hr}%</span></div>
                <input type="range" min="5" max="90" value="${weights.performance.gmv_hr}" class="apple-slider" data-weight-section="performance" data-weight-key="gmv_hr" />
              </div>
              <div class="slider-item">
                <div class="slider-item-header"><span>CTOR / Conversion</span><span id="label-pw-ctor">${weights.performance.ctor}%</span></div>
                <input type="range" min="5" max="90" value="${weights.performance.ctor}" class="apple-slider" data-weight-section="performance" data-weight-key="ctor" />
              </div>
            </div>

            <div class="slider-group">
              <div class="weight-group-heading">
                <h4 style="color:var(--apple-orange)">Qualitative Assessment Weight</h4>
                <span class="weight-total-badge">Linked · 100%</span>
              </div>
              <div class="slider-item">
                <div class="slider-item-header"><span>Call To Action (CTA)</span><span id="label-aw-cta">${weights.assessment.cta}%</span></div>
                <input type="range" min="5" max="85" value="${weights.assessment.cta}" class="apple-slider" data-weight-section="assessment" data-weight-key="cta" />
              </div>
              <div class="slider-item">
                <div class="slider-item-header"><span>Product Pinning (Pin)</span><span id="label-aw-pin">${weights.assessment.pin}%</span></div>
                <input type="range" min="5" max="85" value="${weights.assessment.pin}" class="apple-slider" data-weight-section="assessment" data-weight-key="pin" />
              </div>
              <div class="slider-item">
                <div class="slider-item-header"><span>Discipline & Punctuality</span><span id="label-aw-disc">${weights.assessment.discipline}%</span></div>
                <input type="range" min="5" max="85" value="${weights.assessment.discipline}" class="apple-slider" data-weight-section="assessment" data-weight-key="discipline" />
              </div>
              <div class="slider-item">
                <div class="slider-item-header"><span>Grooming & Presentation</span><span id="label-aw-groom">${weights.assessment.grooming}%</span></div>
                <input type="range" min="5" max="85" value="${weights.assessment.grooming}" class="apple-slider" data-weight-section="assessment" data-weight-key="grooming" />
              </div>
            </div>
          </div>
        </div>

        <div class="glass-card">
          <div class="card-header">
            <div class="card-title-group">
              <h3>Raport Host - Unified Scoring Table</h3>
              <p>${monthLabel}: each PIC averages their Mid + End cycle first; the host score then averages all PIC results equally.</p>
            </div>
          </div>

          <div class="table-responsive">
            <table class="apple-table" data-sortable="true">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Creator</th>
                  <th>Perf Score</th>
                  <th>CTA (1-5)</th>
                  <th>Pin (1-5)</th>
                  <th>Discipline (1-5)</th>
                  <th>Grooming (1-5)</th>
                  <th>Assess Score</th>
                  <th>Final Score</th>
                  <th>Evaluation Action</th>
                </tr>
              </thead>
              <tbody>
                ${scoredHosts.map(h => {
                  const myReview = Scoring.getHostReviewByReviewer(h.name, currentAcc.name, assessmentMonth, assessmentCycle);
                  return `
                    <tr data-app-action="openHostDrawer" data-app-arg="${h.name}" style="cursor:pointer">
                      <td><div class="rank-badge ${h.rank === 1 ? 'rank-1' : (h.rank === 2 ? 'rank-2' : (h.rank === 3 ? 'rank-3' : 'rank-other'))}">${h.rank}</div></td>
                      <td><strong>${h.name}</strong></td>
                      <td><span style="font-weight:600;color:var(--apple-cyan)">${h.perfScore.toFixed(1)}%</span></td>
                      <td>★ ${h.assessData.cta.toFixed(1)}</td>
                      <td>★ ${h.assessData.pin.toFixed(1)}</td>
                      <td>★ ${h.assessData.discipline.toFixed(1)}</td>
                      <td>★ ${h.assessData.grooming.toFixed(1)}</td>
                      <td>
                        <span style="font-weight:600;color:var(--apple-purple)">${h.assessScore.toFixed(1)}%</span>
                        <div class="meta-xs">${h.assessData.reviewerCount || 0} PIC · ${h.assessData.completeReviewerCount || 0} complete 2/2</div>
                      </td>
                      <td style="font-size:15px;font-weight:700;color:var(--text-primary)">${h.finalScore.toFixed(1)}%</td>
                      <td >
                        ${myReview ? `
                          <button class="apple-btn apple-btn-secondary" style="padding:3px 8px;font-size:11px;color:var(--apple-cyan)" data-app-action="openEditReviewModal" data-app-arg="${myReview.id}" data-stop-propagation="true">
                            ✏️ Edit ${cycleLabel} (${myReview.cta.toFixed(1)})
                          </button>
                        ` : `
                          <button class="apple-btn apple-btn-primary" style="padding:3px 8px;font-size:11px" data-app-action="openAddReviewModal" data-app-arg="${h.name}" data-stop-propagation="true">
                            ★ Grade ${cycleLabel}
                          </button>
                        `}
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <div class="glass-card">
          <div class="card-header">
            <div class="card-title-group">
              <h3>${monthLabel} Evaluation Records (${displayedReviews.length})</h3>
              <p>Raw Mid-Month and End-Month ratings. Monthly scoring averages cycles within each PIC before averaging across PICs.</p>
            </div>
            <div class="inline-group">
              <label style="font-size:12px;color:var(--text-tertiary)">Filter Reviewer:</label>
              <select class="select-filter" data-reviewer-filter="true">
                <option value="all" ${this.assessmentFilterReviewer === 'all' ? 'selected' : ''}>All Reviewers (${monthReviews.length})</option>
                ${Accounts.getReviewerAccounts().map(a => `
                  <option value="${a.name}" ${this.assessmentFilterReviewer.toLowerCase() === a.name.toLowerCase() ? 'selected' : ''}>${a.name}</option>
                `).join('')}
              </select>
            </div>
          </div>

          <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(320px, 1fr));gap:14px;">
            ${displayedReviews.map(r => `
              <div class="review-card-item">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                  <div>
                    <div style="font-size:14px;font-weight:700;color:var(--text-primary)">Host: ${r.host}</div>
                    <div style="font-size:11px;color:var(--text-tertiary);margin-top:2px;">
                      By <strong>${r.reviewer}</strong> • ${r.date}
                      <span class="assessment-cycle-badge ${r.cycle === 'end_month' ? 'end' : 'mid'}">
                        ${Scoring.getCycleLabel(r.cycle || Scoring.getCycleForDate(r.date))}
                      </span>
                    </div>
                  </div>
                  <div style="display:flex;gap:6px;">
                    <button class="review-action-btn" data-app-action="openEditReviewModal" data-app-arg="${r.id}" title="Edit this assessment">
                      ✏️ Edit
                    </button>
                    <button class="review-action-btn delete" data-app-action="deleteReview" data-app-arg="${r.id}" title="Delete this assessment">
                      ✕
                    </button>
                  </div>
                </div>

                <div style="display:grid;grid-template-columns:repeat(4, 1fr);gap:6px;background:rgba(255,255,255,0.02);padding:8px;border-radius:var(--radius-sm);text-align:center;">
                  <div><span class="meta-xs">CTA</span><div style="font-size:12.5px;font-weight:700;color:#ffd60a">★${r.cta}</div></div>
                  <div><span class="meta-xs">Pin</span><div style="font-size:12.5px;font-weight:700;color:#ffd60a">★${r.pin}</div></div>
                  <div><span class="meta-xs">Disc</span><div style="font-size:12.5px;font-weight:700;color:#ffd60a">★${r.discipline}</div></div>
                  <div><span class="meta-xs">Groom</span><div style="font-size:12.5px;font-weight:700;color:#ffd60a">★${r.grooming}</div></div>
                </div>

                <div style="font-size:11.5px;color:var(--text-secondary);font-style:italic;">
                  "${r.notes || 'No qualitative comment'}"
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
      requestAnimationFrame(() => {
        this.refreshWeightControls('overall');
        this.refreshWeightControls('performance');
        this.refreshWeightControls('assessment');
      });
    },


    setAssessmentCycle(cycle) {
      if (!['mid_month', 'end_month'].includes(cycle)) return;
      this.assessmentCycle = cycle;
      window.AppStore?.invalidate?.();
      this.renderCurrentView();
    },

    setAssessmentMonth(month) {
      if (!/^\d{4}-\d{2}$/.test(String(month || ''))) return;
      this.assessmentMonth = month;
      window.AppStore?.invalidate?.();
      this.renderCurrentView();
    },

    filterReviewsByReviewer(reviewerName) {
      this.assessmentFilterReviewer = reviewerName;
      this.renderCurrentView();
    },

    refreshWeightControls(group) {
      const labelIds = {
        overall: {
          performance: 'label-w-perf',
          assessment: 'label-w-assess'
        },
        performance: {
          gmv: 'label-pw-gmv',
          gmv_hr: 'label-pw-gmvhr',
          ctor: 'label-pw-ctor'
        },
        assessment: {
          cta: 'label-aw-cta',
          pin: 'label-aw-pin',
          discipline: 'label-aw-disc',
          grooming: 'label-aw-groom'
        }
      };

      const values = Scoring.weights[group] || {};
      Object.entries(labelIds[group] || {}).forEach(([key, labelId]) => {
        const value = Number(values[key] || 0);
        const label = document.getElementById(labelId);
        const slider = document.querySelector(
          `[data-weight-section="${group}"][data-weight-key="${key}"]`
        );

        if (label) label.textContent = value + '%';
        if (slider) {
          slider.value = value;
          const min = Number(slider.min || 0);
          const max = Number(slider.max || 100);
          const progress = max > min ? ((value - min) / (max - min)) * 100 : 0;
          slider.style.setProperty('--slider-progress', `${Math.max(0, Math.min(100, progress))}%`);
        }
      });
    },

    onWeightChange(group, key, val) {
      Scoring.rebalanceWeightGroup(group, key, val);
      Scoring.saveWeights(Scoring.weights);
      this.refreshWeightControls(group);
    },

    commitWeightChange() {
      window.AppStore?.invalidate?.();
      this.renderCurrentView();
    },

    resetDefaultWeights() {
      Scoring.weights = {
        overall: { performance: 70, assessment: 30 },
        performance: { gmv: 40, gmv_hr: 33, ctor: 27, views: 0, sold_qty: 0 },
        assessment: { cta: 30, pin: 25, discipline: 25, grooming: 20 }
      };
      Scoring.saveWeights(Scoring.weights);
      this.renderCurrentView();
    },

    // 7. REPORTS VIEW
    renderReportsView(container, data) {
      const { kpis, scoredHosts } = data;

      container.innerHTML = `
        <div class="print-header">
          <img src="assets/fyc-logo.svg" alt="FYC" class="report-fyc-logo" />
          <div>
            <h1>Livestream Performance Intelligence Executive Report</h1>
            <p>FYC Agency • Generated on ${new Date().toLocaleDateString('id-ID')}</p>
          </div>
        </div>

        <div class="view-header">
          <div>
            <h2 class="view-title">Executive Report Generator</h2>
            <p class="view-subtitle">Print or download high-resolution intelligence summaries ready for leadership and brand partners</p>
          </div>
          <div class="action-row">
            <button class="apple-btn apple-btn-secondary" data-app-action="exportSessionsCSV">Export Master CSV</button>
            <button class="apple-btn apple-btn-primary" data-app-action="print">Print / Export PDF</button>
          </div>
        </div>

        <div class="glass-card">
          <div class="card-header">
            <div class="card-title-group">
              <h3>Executive Operational Summary</h3>
              <p>Consolidated results for July - September 2026</p>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:16px;padding-bottom:16px;">
            <div><span class="helper-text">TOTAL GMV GENERATED</span><div style="font-size:22px;font-weight:700;color:var(--apple-cyan)">${AppleCharts.formatIDR(kpis.totalGMV)}</div></div>
            <div><span class="helper-text">TOTAL BROADCAST TIME</span><div style="font-size:22px;font-weight:700">${kpis.totalDuration.toFixed(1)} Hours</div></div>
            <div><span class="helper-text">AVERAGE PRODUCTIVITY</span><div style="font-size:22px;font-weight:700">${AppleCharts.formatIDR(kpis.avgGmvHour)}/hr</div></div>
            <div><span class="helper-text">TOTAL UNITS SOLD</span><div style="font-size:22px;font-weight:700">${kpis.totalSold.toLocaleString()} pcs</div></div>
          </div>
        </div>

        <div class="glass-card">
          <div class="card-header">
            <div class="card-title-group">
              <h3>Creator Performance Ranking</h3>
              <p>Top performers evaluated against unified scoring matrix</p>
            </div>
          </div>
          <div class="table-responsive">
            <table class="apple-table" data-sortable="true">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Host</th>
                  <th>Tier</th>
                  <th>Total GMV</th>
                  <th>Hours</th>
                  <th>GMV/Hour</th>
                  <th>CTOR</th>
                  <th>Final Score</th>
                </tr>
              </thead>
              <tbody>
                ${scoredHosts.map(h => `
                  <tr>
                    <td>#${h.rank}</td>
                    <td><strong>${h.name}</strong></td>
                    <td><span class="tier-badge" style="background:${h.tierColor}25;color:${h.tierColor}">${h.tier}</span></td>
                    <td style="color:var(--apple-cyan);font-weight:600">${AppleCharts.formatIDR(h.gmv)}</td>
                    <td>${h.duration.toFixed(0)} hrs</td>
                    <td>${AppleCharts.formatIDR(h.gmvHour)}</td>
                    <td>${h.avgCtor.toFixed(1)}%</td>
                    <td><strong>${h.finalScore.toFixed(1)}%</strong></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    },


  });
})(window);
