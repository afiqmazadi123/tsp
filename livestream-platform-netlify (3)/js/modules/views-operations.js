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
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <div>
            <h2 style="font-size:20px;font-weight:700">Creator Payroll Validation & Settlement</h2>
            <p style="font-size:12.5px;color:var(--text-tertiary)">Formula: Approved Live Hours × Applicable Rate + Performance Milestone Incentive</p>
          </div>
          <div style="display:flex;gap:10px;">
            <button class="apple-btn apple-btn-secondary" onclick="App.approveAllPayroll()">Approve All</button>
            <button class="apple-btn apple-btn-primary" onclick="App.exportPayrollCSV()">Export Payroll CSV</button>
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
            <div class="kpi-value">${payrollSummary.totalHoursAll.toFixed(0)} <span style="font-size:14px;font-weight:500;color:var(--text-tertiary)">hrs</span></div>
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
            <table class="apple-table">
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
                      <button class="apple-btn apple-btn-secondary" style="padding:1px 6px;font-size:10px;margin-left:6px" onclick="App.openAdjustRateModal('${p.name}')">Edit</button>
                    </td>
                    <td>${AppleCharts.formatIDR(p.basePay)}</td>
                    <td>
                      <span style="color:var(--apple-yellow);font-weight:600">${AppleCharts.formatIDR(p.bonus)}</span>
                      <div style="font-size:10px;color:var(--text-tertiary)">${p.bonusLabel}</div>
                    </td>
                    <td style="font-size:14px;font-weight:700;color:var(--apple-green)">${AppleCharts.formatIDR(p.totalPay)}</td>
                    <td>
                      <span class="tier-badge" style="background:${p.status === 'Approved' ? 'rgba(48, 209, 88, 0.2)' : (p.status === 'Paid' ? 'rgba(0, 113, 227, 0.2)' : 'rgba(255, 159, 10, 0.2)')};color:${p.status === 'Approved' ? 'var(--apple-green)' : (p.status === 'Paid' ? 'var(--apple-cyan)' : 'var(--apple-orange)')}">
                        ${p.status}
                      </span>
                    </td>
                    <td>
                      <button class="apple-btn apple-btn-secondary" style="padding:3px 8px;font-size:11px" onclick="App.toggleHostPayrollStatus('${p.name}')">
                        ${p.status === 'Approved' ? 'Mark Paid' : (p.status === 'Paid' ? 'Reset' : 'Approve')}
                      </button>
                      <button class="apple-btn apple-btn-secondary" style="padding:3px 8px;font-size:11px" onclick="App.openPayrollSlipModal('${p.name}')">Slip</button>
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
      const allReviews = Scoring.assessments;

      const myReviews = Scoring.getReviewsByReviewer(currentAcc.name);
      const myEvaluatedHostNames = new Set(myReviews.map(r => r.host.toLowerCase()));
      const totalHostsCount = scoredHosts.length;
      const evaluatedCount = myEvaluatedHostNames.size;
      const pendingCount = Math.max(0, totalHostsCount - evaluatedCount);

      let displayedReviews = allReviews;
      if (this.assessmentFilterReviewer !== 'all') {
        displayedReviews = allReviews.filter(r => r.reviewer.toLowerCase() === this.assessmentFilterReviewer.toLowerCase());
      }

      container.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <div>
            <h2 style="font-size:20px;font-weight:700">Multi-Reviewer Assessment & Scoring Engine</h2>
            <p style="font-size:12.5px;color:var(--text-tertiary)">Grade host performance, update previous evaluations, and configure scoring formulas</p>
          </div>
          <div style="display:flex;gap:10px;">
            <button class="apple-btn apple-btn-secondary" onclick="App.openAccountSwitcherModal()">Switch Evaluator (${currentAcc.name})</button>
            <button class="apple-btn apple-btn-primary" onclick="App.openAddReviewModal()">+ Grade Host</button>
          </div>
        </div>

        <div class="evaluator-progress-banner" style="margin-bottom:16px;">
          <div style="display:flex;align-items:center;gap:14px;">
            <div class="user-avatar" style="background:${currentAcc.avatarColor};width:44px;height:44px;font-size:16px;">
              ${currentAcc.initials}
            </div>
            <div>
              <div style="font-size:14.5px;font-weight:700;color:var(--text-primary)">
                Reviewer Active: ${currentAcc.name} (${currentAcc.role})
              </div>
              <div style="font-size:12px;color:var(--text-secondary);margin-top:2px;">
                You have submitted evaluations for <strong>${evaluatedCount} of ${totalHostsCount} creators</strong> (${pendingCount} pending your review).
              </div>
            </div>
          </div>
          <div style="display:flex;gap:8px;">
            <button class="apple-btn apple-btn-secondary" style="font-size:11.5px;padding:5px 12px;" onclick="App.filterReviewsByReviewer('${currentAcc.name}')">
              View My Evaluations (${myReviews.length})
            </button>
            <button class="apple-btn apple-btn-secondary" style="font-size:11.5px;padding:5px 12px;" onclick="App.filterReviewsByReviewer('all')">
              View All Reviews (${allReviews.length})
            </button>
          </div>
        </div>

        <div class="glass-card">
          <div class="card-header">
            <div class="card-title-group">
              <h3>Configurable Scoring Engine Weights</h3>
              <p>Drag sliders to dynamically rebalance team performance scoring</p>
            </div>
            <button class="apple-btn apple-btn-secondary" onclick="App.resetDefaultWeights()">Reset Defaults</button>
          </div>

          <div class="scoring-config-panel">
            <div class="slider-group">
              <h4 style="font-size:13px;font-weight:600;color:var(--apple-cyan)">Overall Weight Split</h4>
              <div class="slider-item">
                <div class="slider-item-header">
                  <span>Quantitative Performance</span>
                  <span id="label-w-perf">${weights.overall.performance}%</span>
                </div>
                <input type="range" min="10" max="90" value="${weights.overall.performance}" class="apple-slider" id="slider-w-perf" oninput="App.onWeightChange('overall', 'performance', this.value)" />
              </div>
              <div class="slider-item">
                <div class="slider-item-header">
                  <span>Qualitative Assessment</span>
                  <span id="label-w-assess">${weights.overall.assessment}%</span>
                </div>
                <input type="range" min="10" max="90" value="${weights.overall.assessment}" class="apple-slider" id="slider-w-assess" oninput="App.onWeightChange('overall', 'assessment', this.value)" />
              </div>
            </div>

            <div class="slider-group">
              <h4 style="font-size:13px;font-weight:600;color:var(--apple-purple)">Performance Metrics Weight</h4>
              <div class="slider-item">
                <div class="slider-item-header"><span>GMV Volume</span><span id="label-pw-gmv">${weights.performance.gmv}%</span></div>
                <input type="range" min="5" max="60" value="${weights.performance.gmv}" class="apple-slider" oninput="App.onWeightChange('performance', 'gmv', this.value)" />
              </div>
              <div class="slider-item">
                <div class="slider-item-header"><span>GMV / Hour Productivity</span><span id="label-pw-gmvhr">${weights.performance.gmv_hr}%</span></div>
                <input type="range" min="5" max="60" value="${weights.performance.gmv_hr}" class="apple-slider" oninput="App.onWeightChange('performance', 'gmv_hr', this.value)" />
              </div>
              <div class="slider-item">
                <div class="slider-item-header"><span>CTOR / Conversion</span><span id="label-pw-ctor">${weights.performance.ctor}%</span></div>
                <input type="range" min="5" max="60" value="${weights.performance.ctor}" class="apple-slider" oninput="App.onWeightChange('performance', 'ctor', this.value)" />
              </div>
            </div>

            <div class="slider-group">
              <h4 style="font-size:13px;font-weight:600;color:var(--apple-orange)">Qualitative Assessment Weight</h4>
              <div class="slider-item">
                <div class="slider-item-header"><span>Call To Action (CTA)</span><span id="label-aw-cta">${weights.assessment.cta}%</span></div>
                <input type="range" min="5" max="50" value="${weights.assessment.cta}" class="apple-slider" oninput="App.onWeightChange('assessment', 'cta', this.value)" />
              </div>
              <div class="slider-item">
                <div class="slider-item-header"><span>Product Pinning (Pin)</span><span id="label-aw-pin">${weights.assessment.pin}%</span></div>
                <input type="range" min="5" max="50" value="${weights.assessment.pin}" class="apple-slider" oninput="App.onWeightChange('assessment', 'pin', this.value)" />
              </div>
              <div class="slider-item">
                <div class="slider-item-header"><span>Discipline & Punctuality</span><span id="label-aw-disc">${weights.assessment.discipline}%</span></div>
                <input type="range" min="5" max="50" value="${weights.assessment.discipline}" class="apple-slider" oninput="App.onWeightChange('assessment', 'discipline', this.value)" />
              </div>
              <div class="slider-item">
                <div class="slider-item-header"><span>Grooming & Presentation</span><span id="label-aw-groom">${weights.assessment.grooming}%</span></div>
                <input type="range" min="5" max="50" value="${weights.assessment.grooming}" class="apple-slider" oninput="App.onWeightChange('assessment', 'grooming', this.value)" />
              </div>
            </div>
          </div>
        </div>

        <div class="glass-card">
          <div class="card-header">
            <div class="card-title-group">
              <h3>Raport Host - Unified Scoring Table</h3>
              <p>Combined performance & multi-reviewer evaluation results</p>
            </div>
          </div>

          <div class="table-responsive">
            <table class="apple-table">
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
                  const myReview = Scoring.getHostReviewByReviewer(h.name, currentAcc.name);
                  return `
                    <tr onclick="App.openHostDrawer('${h.name}')" style="cursor:pointer">
                      <td><div class="rank-badge ${h.rank === 1 ? 'rank-1' : (h.rank === 2 ? 'rank-2' : (h.rank === 3 ? 'rank-3' : 'rank-other'))}">${h.rank}</div></td>
                      <td><strong>${h.name}</strong></td>
                      <td><span style="font-weight:600;color:var(--apple-cyan)">${h.perfScore.toFixed(1)}%</span></td>
                      <td>★ ${h.assessData.cta.toFixed(1)}</td>
                      <td>★ ${h.assessData.pin.toFixed(1)}</td>
                      <td>★ ${h.assessData.discipline.toFixed(1)}</td>
                      <td>★ ${h.assessData.grooming.toFixed(1)}</td>
                      <td><span style="font-weight:600;color:var(--apple-purple)">${h.assessScore.toFixed(1)}%</span></td>
                      <td style="font-size:15px;font-weight:700;color:var(--text-primary)">${h.finalScore.toFixed(1)}%</td>
                      <td onclick="event.stopPropagation()">
                        ${myReview ? `
                          <button class="apple-btn apple-btn-secondary" style="padding:3px 8px;font-size:11px;color:var(--apple-cyan)" onclick="App.openEditReviewModal('${myReview.id}')">
                            ✏️ Edit My Score (${myReview.cta.toFixed(1)})
                          </button>
                        ` : `
                          <button class="apple-btn apple-btn-primary" style="padding:3px 8px;font-size:11px" onclick="App.openAddReviewModal('${h.name}')">
                            ★ Grade Host
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
              <h3>Team Evaluation Records (${displayedReviews.length})</h3>
              <p>Individual ratings submitted by reviewers. Click Edit to adjust scores or notes.</p>
            </div>
            <div style="display:flex;align-items:center;gap:10px;">
              <label style="font-size:12px;color:var(--text-tertiary)">Filter Reviewer:</label>
              <select class="select-filter" onchange="App.filterReviewsByReviewer(this.value)">
                <option value="all" ${this.assessmentFilterReviewer === 'all' ? 'selected' : ''}>All Reviewers (${allReviews.length})</option>
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
                    </div>
                  </div>
                  <div style="display:flex;gap:6px;">
                    <button class="review-action-btn" onclick="App.openEditReviewModal('${r.id}')" title="Edit this assessment">
                      ✏️ Edit
                    </button>
                    <button class="review-action-btn delete" onclick="App.deleteReview('${r.id}')" title="Delete this assessment">
                      ✕
                    </button>
                  </div>
                </div>

                <div style="display:grid;grid-template-columns:repeat(4, 1fr);gap:6px;background:rgba(255,255,255,0.02);padding:8px;border-radius:var(--radius-sm);text-align:center;">
                  <div><span style="font-size:10px;color:var(--text-tertiary)">CTA</span><div style="font-size:12.5px;font-weight:700;color:#ffd60a">★${r.cta}</div></div>
                  <div><span style="font-size:10px;color:var(--text-tertiary)">Pin</span><div style="font-size:12.5px;font-weight:700;color:#ffd60a">★${r.pin}</div></div>
                  <div><span style="font-size:10px;color:var(--text-tertiary)">Disc</span><div style="font-size:12.5px;font-weight:700;color:#ffd60a">★${r.discipline}</div></div>
                  <div><span style="font-size:10px;color:var(--text-tertiary)">Groom</span><div style="font-size:12.5px;font-weight:700;color:#ffd60a">★${r.grooming}</div></div>
                </div>

                <div style="font-size:11.5px;color:var(--text-secondary);font-style:italic;">
                  "${r.notes || 'No qualitative comment'}"
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    },

    filterReviewsByReviewer(reviewerName) {
      this.assessmentFilterReviewer = reviewerName;
      this.renderCurrentView();
    },

    onWeightChange(group, key, val) {
      val = parseInt(val, 10);
      if (group === 'overall') {
        Scoring.weights.overall.performance = val;
        Scoring.weights.overall.assessment = 100 - val;
        document.getElementById('label-w-perf').textContent = val + '%';
        document.getElementById('label-w-assess').textContent = (100 - val) + '%';
      } else {
        Scoring.weights[group][key] = val;
        const lbl = document.getElementById(`label-${group === 'performance' ? 'pw' : 'aw'}-${key}`);
        if (lbl) lbl.textContent = val + '%';
      }
      Scoring.saveWeights(Scoring.weights);
      this.renderCurrentView();
    },

    resetDefaultWeights() {
      Scoring.weights = {
        overall: { performance: 70, assessment: 30 },
        performance: { gmv: 30, gmv_hr: 25, ctor: 20, views: 15, sold_qty: 10 },
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
          <h1>Livestream Performance Intelligence Executive Report</h1>
          <p>FYC Agency • Generated on ${new Date().toLocaleDateString('id-ID')}</p>
        </div>

        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <div>
            <h2 style="font-size:20px;font-weight:700">Executive Report Generator</h2>
            <p style="font-size:12.5px;color:var(--text-tertiary)">Print or download high-resolution intelligence summaries ready for leadership and brand partners</p>
          </div>
          <div style="display:flex;gap:10px;">
            <button class="apple-btn apple-btn-secondary" onclick="App.exportSessionsCSV()">Export Master CSV</button>
            <button class="apple-btn apple-btn-primary" onclick="window.print()">Print / Export PDF</button>
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
            <div><span style="font-size:11px;color:var(--text-tertiary)">TOTAL GMV GENERATED</span><div style="font-size:22px;font-weight:700;color:var(--apple-cyan)">${AppleCharts.formatIDR(kpis.totalGMV)}</div></div>
            <div><span style="font-size:11px;color:var(--text-tertiary)">TOTAL BROADCAST TIME</span><div style="font-size:22px;font-weight:700">${kpis.totalDuration.toFixed(1)} Hours</div></div>
            <div><span style="font-size:11px;color:var(--text-tertiary)">AVERAGE PRODUCTIVITY</span><div style="font-size:22px;font-weight:700">${AppleCharts.formatIDR(kpis.avgGmvHour)}/hr</div></div>
            <div><span style="font-size:11px;color:var(--text-tertiary)">TOTAL UNITS SOLD</span><div style="font-size:22px;font-weight:700">${kpis.totalSold.toLocaleString()} pcs</div></div>
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
            <table class="apple-table">
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
