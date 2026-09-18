/**
 * Extracted from app.js — drawers, modals, imports, and exports
 */
(function(window) {
  'use strict';
  const App = window.App;
  if (!App) return;

  Object.assign(App, {
    // --- HOST DETAIL DRAWER ---
    openHostDrawer(hostName) {
      this.selectedHostForDrawer = hostName;
      const drawer = document.getElementById('host-detail-drawer');
      if (!drawer) return;

      const allAggs = window.AppStore?.hostAggs || Analytics.getHostAggregates(Analytics.getFilteredSessions());
      const scored = Scoring.computeAllHostScores(allAggs).find(h => h.name.toLowerCase() === hostName.toLowerCase());
      const rateHistory = Payroll.getHostRateHistory(hostName);
      const reviews = Scoring.getHostReviews(hostName);
      const currentRate = Payroll.getHostRate(hostName);

      const content = document.getElementById('drawer-content-area');
      if (!content || !scored) return;

      content.innerHTML = `
        <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px;">
          <div class="host-avatar" style="width:60px;height:60px;font-size:22px;background:${scored.tierColor}">
            ${scored.name.substring(0, 2).toUpperCase()}
          </div>
          <div>
            <h2 style="font-size:22px;font-weight:700">${scored.name}</h2>
            <div style="display:flex;gap:8px;margin-top:4px;">
              <span class="tier-badge" style="background:${scored.tierColor}25;color:${scored.tierColor}">${scored.tier} (Rank #${scored.rank})</span>
              <span class="tier-badge" style="background:rgba(255,255,255,0.08);color:var(--text-secondary)">Rate: ${AppleCharts.formatIDR(currentRate)}/hr</span>
            </div>
          </div>
        </div>

        <div class="host-stats-row" style="margin-bottom:20px;">
          <div class="host-stat-box"><div class="title">Total GMV</div><div class="val" style="color:var(--apple-cyan)">${AppleCharts.formatIDRShort(scored.gmv)}</div></div>
          <div class="host-stat-box"><div class="title">Live Hours</div><div class="val">${scored.duration.toFixed(0)}h</div></div>
          <div class="host-stat-box"><div class="title">GMV/Hour</div><div class="val">${AppleCharts.formatIDRShort(scored.gmvHour)}</div></div>
        </div>

        <div class="glass-card" style="margin-bottom:20px;padding:16px;">
          <h4 style="font-size:13px;font-weight:600;margin-bottom:8px;">Evaluation Radar</h4>
          <canvas id="hostRadarCanvas" style="width:100%;height:200px;display:block"></canvas>
        </div>

        <div class="glass-card" style="margin-bottom:20px;padding:16px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
            <div>
              <h4 style="font-size:13px;font-weight:600;">PIC Monthly Averages</h4>
              <p class="helper-text">Each PIC is weighted equally after averaging their Mid-Month + End-Month cycles.</p>
            </div>
            <span class="weight-total-badge">${scored.assessData.reviewerCount || 0} PIC</span>
          </div>
          <div class="pic-average-list">
            ${(scored.assessData.reviewerSummaries || []).length ? scored.assessData.reviewerSummaries.map(summary => {
              const raw = (summary.cta + summary.pin + summary.discipline + summary.grooming) / 4;
              return `
                <div class="pic-average-row">
                  <div>
                    <strong>${summary.reviewer}</strong>
                    <span>${summary.completedBothCycles ? '2/2 cycles complete' : summary.cycleCount + '/2 cycles complete'}</span>
                  </div>
                  <div class="pic-average-metrics">
                    <span>CTA ${summary.cta.toFixed(1)}</span>
                    <span>Pin ${summary.pin.toFixed(1)}</span>
                    <span>Disc ${summary.discipline.toFixed(1)}</span>
                    <span>Groom ${summary.grooming.toFixed(1)}</span>
                    <strong>Avg ${raw.toFixed(2)}</strong>
                  </div>
                </div>
              `;
            }).join('') : '<div class="helper-text">No PIC assessment submitted for this month yet.</div>'}
          </div>
        </div>

        <div class="glass-card" style="margin-bottom:20px;padding:16px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
            <h4 style="font-size:13px;font-weight:600;">Supervisor Assessments (${reviews.length})</h4>
            <button class="apple-btn apple-btn-secondary" style="padding:2px 8px;font-size:10px" data-app-action="openAddReviewModal" data-app-arg="${scored.name}">+ Grade Host</button>
          </div>
          <div class="stack-10">
            ${reviews.length > 0 ? reviews.map(r => `
              <div style="padding:12px;background:rgba(255,255,255,0.03);border-radius:var(--radius-sm);border:1px solid var(--border-subtle)">
                <div style="display:flex;justify-content:space-between;align-items:center;font-size:12px;font-weight:600;">
                  <span>👤 ${r.reviewer}</span>
                  <div style="display:flex;align-items:center;gap:6px;">
                    <span style="font-size:11px;color:var(--text-tertiary);margin-right:4px;">${r.date}</span>
                    <span class="assessment-cycle-badge ${r.cycle === 'end_month' ? 'end' : 'mid'}">${Scoring.getCycleLabel(r.cycle || Scoring.getCycleForDate(r.date))}</span>
                    <button class="review-action-btn" data-app-action="openEditReviewModal" data-app-arg="${r.id}" title="Edit this assessment">✏️ Edit</button>
                    <button class="review-action-btn delete" data-app-action="deleteReview" data-app-arg="${r.id}" title="Delete this assessment">✕</button>
                  </div>
                </div>
                <div style="font-size:11.5px;color:var(--apple-yellow);margin:6px 0;">
                  CTA: ★${r.cta} • Pin: ★${r.pin} • Discipline: ★${r.discipline} • Grooming: ★${r.grooming}
                </div>
                <div style="font-size:11.5px;color:var(--text-secondary);font-style:italic">"${r.notes || 'No notes provided'}"</div>
              </div>
            `).join('') : '<div style="font-size:12px;color:var(--text-tertiary);text-align:center;padding:12px 0;">No supervisor reviews recorded yet.</div>'}
          </div>
        </div>

        <div class="glass-card" style="padding:16px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
            <h4 style="font-size:13px;font-weight:600;">Hourly Rate History</h4>
            <button class="apple-btn apple-btn-secondary" style="padding:2px 8px;font-size:10px" data-app-action="openAdjustRateModal" data-app-arg="${scored.name}">Adjust Rate</button>
          </div>
          <div style="display:flex;flex-direction:column;gap:8px;">
            ${rateHistory.length > 0 ? rateHistory.map(h => `
              <div style="display:flex;justify-content:space-between;font-size:11.5px;padding:6px 0;border-bottom:1px solid var(--border-subtle)">
                <span>${h.date}: ${AppleCharts.formatIDR(h.old_rate)} → <strong>${AppleCharts.formatIDR(h.new_rate)}</strong></span>
                <span style="color:var(--text-tertiary)">${h.reason}</span>
              </div>
            `).join('') : '<div style="font-size:11.5px;color:var(--text-tertiary)">No prior rate adjustments recorded.</div>'}
          </div>
        </div>
      `;

      drawer.classList.add('active');

      setTimeout(() => {
        const radarCanvas = document.getElementById('hostRadarCanvas');
        if (radarCanvas) {
          AppleCharts.drawRadarChart(radarCanvas, {
            labels: ['CTA', 'Pin', 'Discipline', 'Grooming', 'Performance'],
            values: [
              scored.assessData.cta,
              scored.assessData.pin,
              scored.assessData.discipline,
              scored.assessData.grooming,
              (scored.perfScore / 20)
            ]
          });
        }
      }, 50);
    },

    closeHostDrawer() {
      const drawer = document.getElementById('host-detail-drawer');
      if (drawer) drawer.classList.remove('active');
      this.selectedHostForDrawer = null;
    },

    // --- MODAL: ADD / EDIT ASSESSMENTS ---
    openAddReviewModal(preselectedHost = '') {
      const modal = document.getElementById('generic-modal');
      const container = document.getElementById('modal-inner-content');
      if (!modal || !container) return;

      const hosts = window.MASTER_HOST_PROFILES || [];
      const reviewerAccounts = Accounts.getReviewerAccounts();
      const currentAcc = Accounts.getCurrentAccount();

      const assessmentMonth = this.assessmentMonth || Scoring.getCurrentMonth();
      const assessmentCycle = this.assessmentCycle || Scoring.getCycleForDate();
      const cycleLabel = Scoring.getCycleLabel(assessmentCycle);
      const cycleDateLabel = Scoring.getCycleDateLabel(assessmentMonth, assessmentCycle);
      const monthLabel = new Date(`${assessmentMonth}-01T12:00:00`).toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric'
      });

      let existingReview = null;
      if (preselectedHost) {
        existingReview = Scoring.getHostReviewByReviewer(
          preselectedHost,
          currentAcc.name,
          assessmentMonth,
          assessmentCycle
        );
      }

      container.innerHTML = `
        <h3 style="font-size:18px;font-weight:700;margin-bottom:6px;">
          ${existingReview ? 'Update ' + cycleLabel + ' Assessment for ' + preselectedHost : 'Submit ' + cycleLabel + ' Assessment'}
        </h3>
        <p class="muted-copy">
          ${monthLabel} · ${cycleLabel} (day ${cycleDateLabel}). Each PIC can submit one assessment per host per cycle. Monthly scoring averages both cycles per PIC, then averages all PICs equally.
        </p>
        <form id="add-review-form" class="form-stack">
          <div>
            <label class="form-label">Select Creator</label>
            <select id="rev-host-select" class="select-filter full-width" data-review-host-select="true">
              ${hosts.map(h => `<option value="${h.name}" ${h.name.toLowerCase() === preselectedHost.toLowerCase() ? 'selected' : ''}>${h.name}</option>`).join('')}
            </select>
          </div>

          <div>
            <label class="form-label">Reviewer (Secure Identity)</label>
            <div class="assessment-reviewer-lock">
              <div class="user-avatar" style="background:${currentAcc.avatarColor};width:30px;height:30px;font-size:11px;">${currentAcc.initials}</div>
              <div>
                <strong>${currentAcc.name}</strong>
                <span>${currentAcc.role} · identity locked by Supabase Auth</span>
              </div>
            </div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
            <div>
              <div style="display:flex;justify-content:space-between;font-size:11.5px;color:var(--text-secondary);margin-bottom:4px;">
                <span>Call To Action (CTA)</span>
                <strong id="val-preview-cta">${existingReview ? existingReview.cta : '4.8'}</strong>
              </div>
              <input type="range" id="rev-cta" min="1.0" max="5.0" step="0.1" value="${existingReview ? existingReview.cta : '4.8'}" class="apple-slider" data-preview-target="val-preview-cta" />
            </div>
            <div>
              <div style="display:flex;justify-content:space-between;font-size:11.5px;color:var(--text-secondary);margin-bottom:4px;">
                <span>Product Pinning (Pin)</span>
                <strong id="val-preview-pin">${existingReview ? existingReview.pin : '4.7'}</strong>
              </div>
              <input type="range" id="rev-pin" min="1.0" max="5.0" step="0.1" value="${existingReview ? existingReview.pin : '4.7'}" class="apple-slider" data-preview-target="val-preview-pin" />
            </div>
            <div>
              <div style="display:flex;justify-content:space-between;font-size:11.5px;color:var(--text-secondary);margin-bottom:4px;">
                <span>Discipline & Punctuality</span>
                <strong id="val-preview-disc">${existingReview ? existingReview.discipline : '5.0'}</strong>
              </div>
              <input type="range" id="rev-disc" min="1.0" max="5.0" step="0.1" value="${existingReview ? existingReview.discipline : '5.0'}" class="apple-slider" data-preview-target="val-preview-disc" />
            </div>
            <div>
              <div style="display:flex;justify-content:space-between;font-size:11.5px;color:var(--text-secondary);margin-bottom:4px;">
                <span>Grooming & Presentation</span>
                <strong id="val-preview-groom">${existingReview ? existingReview.grooming : '4.9'}</strong>
              </div>
              <input type="range" id="rev-groom" min="1.0" max="5.0" step="0.1" value="${existingReview ? existingReview.grooming : '4.9'}" class="apple-slider" data-preview-target="val-preview-groom" />
            </div>
          </div>

          <div>
            <label class="form-label">Reviewer Notes & Feedback</label>
            <textarea id="rev-notes" rows="3" class="select-filter" style="width:100%;resize:vertical" placeholder="Enter qualitative observations, strengths, or areas for improvement...">${existingReview ? (existingReview.notes || '') : ''}</textarea>
          </div>

          <div class="form-actions">
            <button type="button" class="apple-btn apple-btn-secondary" data-app-action="closeModal">Cancel</button>
            <button type="submit" class="apple-btn apple-btn-primary">Save Assessment</button>
          </div>
        </form>
      `;

      document.getElementById('add-review-form').onsubmit = (e) => {
        e.preventDefault();
        const host = document.getElementById('rev-host-select').value;
        const reviewer = currentAcc.name;
        const cta = parseFloat(document.getElementById('rev-cta').value);
        const pin = parseFloat(document.getElementById('rev-pin').value);
        const discipline = parseFloat(document.getElementById('rev-disc').value);
        const grooming = parseFloat(document.getElementById('rev-groom').value);
        const notes = document.getElementById('rev-notes').value || 'Good overall performance.';

        Scoring.addAssessment({
          host,
          reviewer,
          reviewer_account_id: currentAcc.id,
          assessment_month: `${assessmentMonth}-01`,
          cycle: assessmentCycle,
          cta,
          pin,
          discipline,
          grooming,
          notes
        });
        this.closeModal();
        this.renderCurrentView();
        if (this.selectedHostForDrawer) this.openHostDrawer(this.selectedHostForDrawer);
      };

      modal.classList.add('active');
    },

    onReviewHostChange(hostName) {
      const currentAcc = Accounts.getCurrentAccount();
      const existing = Scoring.getHostReviewByReviewer(
        hostName,
        currentAcc.name,
        this.assessmentMonth || Scoring.getCurrentMonth(),
        this.assessmentCycle || Scoring.getCycleForDate()
      );
      if (existing) {
        document.getElementById('rev-cta').value = existing.cta;
        document.getElementById('val-preview-cta').textContent = existing.cta;
        document.getElementById('rev-pin').value = existing.pin;
        document.getElementById('val-preview-pin').textContent = existing.pin;
        document.getElementById('rev-disc').value = existing.discipline;
        document.getElementById('val-preview-disc').textContent = existing.discipline;
        document.getElementById('rev-groom').value = existing.grooming;
        document.getElementById('val-preview-groom').textContent = existing.grooming;
        document.getElementById('rev-notes').value = existing.notes || '';
      } else {
        const defaults = { cta: 4.8, pin: 4.7, discipline: 5.0, grooming: 4.9 };
        ['cta', 'pin', 'disc', 'groom'].forEach(key => {
          const sourceKey = key === 'disc' ? 'discipline' : key;
          const input = document.getElementById(`rev-${key}`);
          const preview = document.getElementById(`val-preview-${key}`);
          if (input) input.value = defaults[sourceKey];
          if (preview) preview.textContent = defaults[sourceKey];
        });
        const notes = document.getElementById('rev-notes');
        if (notes) notes.value = '';
      }
    },

    openEditReviewModal(reviewId) {
      const review = Scoring.getAssessmentById(reviewId);
      if (!review) {
        window.UI?.toast?.('Review record not found.', 'error');
        return;
      }

      const modal = document.getElementById('generic-modal');
      const container = document.getElementById('modal-inner-content');
      if (!modal || !container) return;

      container.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <h3 style="font-size:18px;font-weight:700">Edit Assessment: ${review.host}</h3>
          <button class="review-action-btn delete" data-app-action="deleteReview" data-app-arg="${review.id}" title="Delete Review">Delete Review</button>
        </div>
        <p class="muted-copy">
          Reviewed by <strong>${review.reviewer}</strong> on ${review.date} ·
          <span class="assessment-cycle-badge ${review.cycle === 'end_month' ? 'end' : 'mid'}">${Scoring.getCycleLabel(review.cycle || Scoring.getCycleForDate(review.date))}</span>
        </p>

        <form id="edit-review-form" class="form-stack">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
            <div>
              <div style="display:flex;justify-content:space-between;font-size:11.5px;color:var(--text-secondary);margin-bottom:4px;">
                <span>Call To Action (CTA)</span>
                <strong id="edit-val-cta">${review.cta}</strong>
              </div>
              <input type="range" id="edit-cta" min="1.0" max="5.0" step="0.1" value="${review.cta}" class="apple-slider" data-preview-target="edit-val-cta" />
            </div>

            <div>
              <div style="display:flex;justify-content:space-between;font-size:11.5px;color:var(--text-secondary);margin-bottom:4px;">
                <span>Product Pinning (Pin)</span>
                <strong id="edit-val-pin">${review.pin}</strong>
              </div>
              <input type="range" id="edit-pin" min="1.0" max="5.0" step="0.1" value="${review.pin}" class="apple-slider" data-preview-target="edit-val-pin" />
            </div>

            <div>
              <div style="display:flex;justify-content:space-between;font-size:11.5px;color:var(--text-secondary);margin-bottom:4px;">
                <span>Discipline & Punctuality</span>
                <strong id="edit-val-disc">${review.discipline}</strong>
              </div>
              <input type="range" id="edit-disc" min="1.0" max="5.0" step="0.1" value="${review.discipline}" class="apple-slider" data-preview-target="edit-val-disc" />
            </div>

            <div>
              <div style="display:flex;justify-content:space-between;font-size:11.5px;color:var(--text-secondary);margin-bottom:4px;">
                <span>Grooming & Presentation</span>
                <strong id="edit-val-groom">${review.grooming}</strong>
              </div>
              <input type="range" id="edit-groom" min="1.0" max="5.0" step="0.1" value="${review.grooming}" class="apple-slider" data-preview-target="edit-val-groom" />
            </div>
          </div>

          <div>
            <label class="form-label">Reviewer Notes & Feedback</label>
            <textarea id="edit-notes" rows="3" class="select-filter" style="width:100%;resize:vertical" placeholder="Enter qualitative notes...">${review.notes || ''}</textarea>
          </div>

          <div class="form-actions">
            <button type="button" class="apple-btn apple-btn-secondary" data-app-action="closeModal">Cancel</button>
            <button type="submit" class="apple-btn apple-btn-primary">Update Assessment</button>
          </div>
        </form>
      `;

      document.getElementById('edit-review-form').onsubmit = (e) => {
        e.preventDefault();
        const cta = parseFloat(document.getElementById('edit-cta').value);
        const pin = parseFloat(document.getElementById('edit-pin').value);
        const discipline = parseFloat(document.getElementById('edit-disc').value);
        const grooming = parseFloat(document.getElementById('edit-groom').value);
        const notes = document.getElementById('edit-notes').value;

        Scoring.updateAssessment(reviewId, { cta, pin, discipline, grooming, notes });
        this.closeModal();
        this.renderCurrentView();
        if (this.selectedHostForDrawer) {
          this.openHostDrawer(this.selectedHostForDrawer);
        }
      };

      modal.classList.add('active');
    },

    async deleteReview(reviewId) {
      const confirmed = await window.UI?.confirm?.(
        'Delete this assessment? This cannot be undone.',
        { title: 'Delete assessment', confirmLabel: 'Delete', danger: true }
      );
      if (!confirmed) return;

      Scoring.deleteAssessment(reviewId);
      window.AppStore?.invalidate();
      window.UI?.toast?.('Assessment deleted.', 'success');
      this.closeModal();
      this.renderCurrentView();
      if (this.selectedHostForDrawer) {
        this.openHostDrawer(this.selectedHostForDrawer);
      }
    },

    // --- OTHER MODALS ---
    openAdjustRateModal(hostName) {
      const modal = document.getElementById('generic-modal');
      const container = document.getElementById('modal-inner-content');
      if (!modal || !container) return;

      const currentRate = Payroll.getHostRate(hostName);
      const currentAcc = Accounts.getCurrentAccount();

      container.innerHTML = `
        <h3 class="modal-title">Adjust Hourly Rate: ${hostName}</h3>
        <form id="adjust-rate-form" class="form-stack">
          <div>
            <label class="form-label">New Hourly Rate (IDR)</label>
            <input type="number" id="new-rate-input" value="${currentRate}" step="5000" class="select-filter full-width" />
          </div>
          <div>
            <label class="form-label">Reason for Adjustment</label>
            <input type="text" id="rate-reason-input" value="Performance promotion" class="select-filter full-width" />
          </div>
          <div class="form-actions">
            <button type="button" class="apple-btn apple-btn-secondary" data-app-action="closeModal">Cancel</button>
            <button type="submit" class="apple-btn apple-btn-primary">Update Rate</button>
          </div>
        </form>
      `;

      document.getElementById('adjust-rate-form').onsubmit = (e) => {
        e.preventDefault();
        const r = parseInt(document.getElementById('new-rate-input').value, 10);
        const reason = document.getElementById('rate-reason-input').value;
        Payroll.setHostRate(hostName, r, reason, currentAcc.name);
        this.closeModal();
        this.renderCurrentView();
        if (this.selectedHostForDrawer) this.openHostDrawer(this.selectedHostForDrawer);
      };

      modal.classList.add('active');
    },

    openPayrollSlipModal(hostName) {
      const modal = document.getElementById('generic-modal');
      const container = document.getElementById('modal-inner-content');
      if (!modal || !container) return;

      const hostAggs = Analytics.getHostAggregates(Analytics.getFilteredSessions());
      const summary = Payroll.calculatePayrollSummary(hostAggs, '2026-09');
      const item = summary.items.find(i => i.name.toLowerCase() === hostName.toLowerCase());
      if (!item) return;

      container.innerHTML = `
        <div style="padding:10px;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:1px solid var(--border-subtle);padding-bottom:16px;margin-bottom:16px;">
            <div>
              <h2 style="font-size:18px;font-weight:700">CREATOR PAYROLL SLIP</h2>
              <p style="font-size:11.5px;color:var(--text-tertiary)">FYC Agency Livestreaming Operations</p>
            </div>
            <div style="text-align:right">
              <div style="font-size:12px;font-weight:600">Period: Sep 2026</div>
              <div class="helper-text">Issued: ${new Date().toLocaleDateString('id-ID')}</div>
            </div>
          </div>

          <div style="margin-bottom:16px;">
            <div style="font-size:14px;font-weight:700">${item.name}</div>
            <div style="font-size:12px;color:var(--text-secondary)">Total Shifts: ${item.sessions} | Approved Hours: ${item.hours.toFixed(1)}h</div>
          </div>

          <div style="background:rgba(255,255,255,0.03);border-radius:var(--radius-sm);padding:14px;display:flex;flex-direction:column;gap:8px;margin-bottom:16px;">
            <div style="display:flex;justify-content:space-between;font-size:12.5px;">
              <span>Base Pay (${item.hours.toFixed(1)}h × ${AppleCharts.formatIDR(item.rate)}):</span>
              <span>${AppleCharts.formatIDR(item.basePay)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:12.5px;color:var(--apple-yellow)">
              <span>Performance Bonus (${item.bonusLabel}):</span>
              <span>+ ${AppleCharts.formatIDR(item.bonus)}</span>
            </div>
            <div style="border-top:1px solid var(--border-subtle);padding-top:8px;display:flex;justify-content:space-between;font-size:15px;font-weight:700;color:var(--apple-green)">
              <span>Total Payout:</span>
              <span>${AppleCharts.formatIDR(item.totalPay)}</span>
            </div>
          </div>

          <div style="display:flex;justify-content:flex-end;gap:10px;">
            <button class="apple-btn apple-btn-secondary" data-app-action="closeModal">Close</button>
            <button class="apple-btn apple-btn-primary" data-app-action="print">Print Slip</button>
          </div>
        </div>
      `;

      modal.classList.add('active');
    },

    toggleHostPayrollStatus(hostName) {
      const cur = Payroll.getStatus(hostName, '2026-09');
      let next = 'Approved';
      if (cur === 'Pending') next = 'Approved';
      else if (cur === 'Approved') next = 'Paid';
      else next = 'Pending';

      Payroll.setStatus(hostName, '2026-09', next);
      this.renderCurrentView();
    },

    approveAllPayroll() {
      const hostAggs = Analytics.getHostAggregates(Analytics.getFilteredSessions());
      hostAggs.forEach(h => {
        Payroll.setStatus(h.name, '2026-09', 'Approved');
      });
      this.renderCurrentView();
    },

    openSyncModal() {
      const modal = document.getElementById('generic-modal');
      const container = document.getElementById('modal-inner-content');
      if (!modal || !container) return;

      container.innerHTML = `
        <h3 style="font-size:18px;font-weight:700;margin-bottom:8px;">Data Synchronization & Import</h3>
        <p style="font-size:12.5px;color:var(--text-tertiary);margin-bottom:16px;">
          Synchronize master data directly from Google Sheets or drag and drop an updated CSV file.
        </p>

        <div id="drop-zone" style="border:2px dashed var(--border-subtle);border-radius:var(--radius-md);padding:32px;text-align:center;cursor:pointer;transition:var(--transition-apple);background:rgba(255,255,255,0.02)">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="color:var(--apple-cyan);margin-bottom:8px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          <div style="font-size:14px;font-weight:600">Drag & Drop updated Report CSV here</div>
          <div style="font-size:11.5px;color:var(--text-tertiary);margin-top:4px">or click to browse from computer</div>
          <input type="file" id="file-input" accept=".csv" style="display:none" />
        </div>

        <div style="display:flex;align-items:center;gap:12px;margin:20px 0;">
          <div style="flex:1;height:1px;background:var(--border-subtle)"></div>
          <span style="font-size:11px;color:var(--text-tertiary);text-transform:uppercase">OR SYNC DIRECTLY</span>
          <div style="flex:1;height:1px;background:var(--border-subtle)"></div>
        </div>

        <div class="stack-10">
          <button class="apple-btn apple-btn-primary" style="justify-content:center;padding:10px" data-app-action="triggerSync">
            Sync from Google Sheet (${SyncEngine.sheetId.substring(0, 10)}...)
          </button>
          <button class="apple-btn apple-btn-secondary" style="justify-content:center;padding:10px" data-app-action="closeModal">
            Done
          </button>
        </div>
      `;

      const dropZone = document.getElementById('drop-zone');
      const fileInput = document.getElementById('file-input');

      dropZone.addEventListener('click', () => fileInput.click());
      dropZone.ondragover = (e) => { e.preventDefault(); dropZone.style.borderColor = 'var(--apple-blue)'; };
      dropZone.ondragleave = () => { dropZone.style.borderColor = 'var(--border-subtle)'; };
      dropZone.ondrop = (e) => {
        e.preventDefault();
        dropZone.style.borderColor = 'var(--border-subtle)';
        if (e.dataTransfer.files.length > 0) this.handleCSVFile(e.dataTransfer.files[0]);
      };
      fileInput.onchange = (e) => {
        if (e.target.files.length > 0) this.handleCSVFile(e.target.files[0]);
      };

      modal.classList.add('active');
    },

    handleCSVFile(file) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const text = e.target.result;
        const sessions = SyncEngine.parseCSVToSessions(text);
        if (!sessions.length) {
          window.UI?.toast?.('Failed to parse sessions. Please check the CSV format.', 'error');
          return;
        }

        try {
          await window.UI.withBusy(
            () => window.SupabaseEngine.upsertLivestreamSessions(sessions),
            'Saving private session data…'
          );
          window.MASTER_SESSIONS = sessions;
          window.AppStore?.invalidate?.();
          SyncEngine.updateSyncUI('success', `Securely Imported (${sessions.length.toLocaleString()} sessions)`);
          window.UI?.toast?.(`Securely imported ${sessions.length.toLocaleString('id-ID')} sessions from ${file.name}.`, 'success');
          this.closeModal();
          this.renderCurrentView();
        } catch (err) {
          window.UI?.toast?.(err?.message || 'Secure import failed.', 'error');
        }
      };
      reader.readAsText(file);
    },

    closeModal() {
      const modal = document.getElementById('generic-modal');
      if (modal) modal.classList.remove('active');
    },

    exportSessionsCSV() {
      const sessions = Analytics.getFilteredSessions();
      let csv = 'Date,Brand,Platform,Host,Start,End,Duration,GMV,GMV_Hour,Product,CTR,CTOR,Ads_Cost,Views,Followers,Sold_Qty,Buyer\n';
      sessions.forEach(s => {
        csv += `"${s.date}","${s.brand}","${s.platform}","${s.host}","${s.start}","${s.end}",${s.duration},${s.gmv},${s.gmv_hr},"${(s.product||'').replace(/"/g, '""')}",${s.ctr},${s.ctor},${s.ads_cost},${s.views},${s.followers},${s.sold_qty},${s.buyer}
`;
      });

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `livestream_sessions_export_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
    },

    exportPayrollCSV() {
      const hostAggs = Analytics.getHostAggregates(Analytics.getFilteredSessions());
      const summary = Payroll.calculatePayrollSummary(hostAggs, '2026-09');
      let csv = 'Host,Approved_Hours,Hourly_Rate,Base_Payment,Bonus,Total_Payment,Status\n';
      summary.items.forEach(p => {
        csv += `"${p.name}",${p.hours},${p.rate},${p.basePay},${p.bonus},${p.totalPay},"${p.status}"
`;
      });

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `payroll_summary_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
    }
  });
})(window);
